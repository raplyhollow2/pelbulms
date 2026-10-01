import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { getYoutubeId } from '@/lib/video-url'

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi

export type LinkPreview = {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  siteName?: string | null
}

export function extractUrls(text: string): string[] {
  if (!text) return []
  const matches = text.match(URL_RE) || []
  const cleaned = matches.map((u) => u.replace(/[.,;:!?)]+$/, ''))
  return [...new Set(cleaned)]
}

export function firstNonYoutubeUrl(text: string): string | null {
  for (const url of extractUrls(text)) {
    if (!getYoutubeId(url)) return url
  }
  return null
}

export function firstYoutubeUrl(text: string): string | null {
  for (const url of extractUrls(text)) {
    if (getYoutubeId(url)) return url
  }
  return null
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const prop = key.includes(':') ? 'property' : 'name'
    const re = new RegExp(
      `<meta[^>]+(?:${prop}=["']${key}["'][^>]+content=["']([^"']+)["']|content=["']([^"']+)["'][^>]+${prop}=["']${key}["'])[^>]*>`,
      'i'
    )
    const m = html.match(re)
    const value = m?.[1] || m?.[2]
    if (value?.trim()) return decodeHtml(value.trim())
  }
  return null
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function absoluteUrl(base: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, base).toString()
  } catch {
    return maybeRelative
  }
}

/**
 * Fetch Open Graph / Twitter card metadata for a public URL.
 * Best-effort — returns null on failure (timeouts, blocked sites, etc.).
 */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
])

function isPrivateIp(ip: string) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized.includes(':')) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    )
  }
  const parts = normalized.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

async function publicHttpUrl(raw: string): Promise<URL | null> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return null
  }
  if (isIP(host)) return isPrivateIp(host) ? null : url
  try {
    const records = await lookup(host, { all: true })
    if (!records.length || records.some((record) => isPrivateIp(record.address))) return null
  } catch {
    return null
  }
  return url
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url = await publicHttpUrl(rawUrl)
  if (!url) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    let res: Response | null = null
    for (let hop = 0; hop < 3; hop++) {
      res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PelbuLMS/1.0; +https://pelbu.bt) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        const next = await publicHttpUrl(new URL(location, url).toString())
        if (!next) return null
        url = next
        continue
      }
      break
    }
    if (!res || !res.ok) {
      return { url: url.toString(), title: url.hostname, siteName: url.hostname }
    }
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { url: url.toString(), title: url.hostname, siteName: url.hostname }
    }
    const html = (await res.text()).slice(0, 250_000)
    const title =
      metaContent(html, ['og:title', 'twitter:title']) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      url.hostname
    const description = metaContent(html, [
      'og:description',
      'twitter:description',
      'description',
    ])
    const image = absoluteUrl(
      url.toString(),
      metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])
    )
    const siteName = metaContent(html, ['og:site_name']) || url.hostname

    return {
      url: url.toString(),
      title: decodeHtml(title),
      description,
      image,
      siteName,
    }
  } catch {
    return { url: url.toString(), title: url.hostname, siteName: url.hostname }
  } finally {
    clearTimeout(timer)
  }
}
