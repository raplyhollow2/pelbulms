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
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PelbuLMS/1.0; +https://pelbu.bt) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) {
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
