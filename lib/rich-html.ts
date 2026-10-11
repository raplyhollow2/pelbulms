import sanitizeHtml from 'sanitize-html'
import { resolveMediaUrl } from '@/lib/media'

/** Images, video, and audio in lesson text and course descriptions. */
export const richMediaClass =
  '[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_video]:my-2 [&_video]:h-auto [&_video]:w-full [&_video]:max-w-full [&_audio]:my-2 [&_audio]:w-full'

const FONT_SIZE = /^(1[0-9]|[2-8][0-9]|9[0-6])px$/
const TEXT_ALIGN = /^(left|center|right|justify)$/

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'video',
  'audio',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]

/** http(s), mailto, or a same-site path. Anything else is dropped. */
export function safeLinkHref(raw: string): string | null {
  const value = raw.trim()
  if (!value || /^(javascript|data|vbscript|blob):/i.test(value)) return null
  if (/^mailto:/i.test(value)) {
    const address = value.slice('mailto:'.length).trim()
    if (!address || /[\s<>"]/.test(address)) return null
    return `mailto:${address}`
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeImageSrc(raw: string): string | null {
  const value = raw.trim()
  if (!value || /^(javascript|data|vbscript|blob):/i.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Private lesson media, or the playable proxy URL the editor paints. */
export function mediaRefFromSrc(raw: string): string | null {
  const value = raw.trim()
  if (!value || /^(javascript|data|vbscript|blob):/i.test(value)) return null

  const direct = value.match(/^cloudinary:video:(.+)$/)
  if (direct) {
    const id = direct[1]
    if (!id || id.includes('..') || /[\s<>"']/.test(id)) return null
    return `cloudinary:video:${id}`
  }

  if (!value.startsWith('/api/media/')) return null
  let url: URL
  try {
    url = new URL(value, 'https://local.invalid')
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.origin !== 'https://local.invalid') return null
  const type = url.searchParams.get('type')
  if (type && type !== 'video') return null
  let id = ''
  try {
    id = decodeURIComponent(url.pathname.slice('/api/media/'.length))
  } catch {
    return null
  }
  if (!id || id.includes('..') || id.includes('\\') || /[\s<>"']/.test(id)) return null
  return `cloudinary:video:${id}`
}

function keepStyle(style: string | undefined) {
  if (!style) return ''
  const parts: string[] = []
  for (const chunk of style.split(';')) {
    const splitAt = chunk.indexOf(':')
    if (splitAt === -1) continue
    const prop = chunk.slice(0, splitAt).trim().toLowerCase()
    const value = chunk.slice(splitAt + 1).trim().toLowerCase()
    if (prop === 'font-size' && FONT_SIZE.test(value)) parts.push(`font-size:${value}`)
    else if (prop === 'text-align') {
      const align = value === 'start' ? 'left' : value === 'end' ? 'right' : value
      if (TEXT_ALIGN.test(align)) parts.push(`text-align:${align}`)
    }
  }
  return parts.join(';')
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function mediaAttributes(tagName: 'video' | 'audio', attribs: sanitizeHtml.Attributes) {
  const src = mediaRefFromSrc(attribs.src || '')
  if (!src) return { tagName, attribs: {} }
  const next: sanitizeHtml.Attributes = {
    src,
    controls: '',
    preload: 'metadata',
  }
  if (tagName === 'video') next.playsinline = ''
  return { tagName, attribs: next }
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
    img: ['src', 'alt'],
    video: ['src', 'controls', 'playsinline', 'preload'],
    audio: ['src', 'controls', 'preload'],
    span: ['style'],
    p: ['style'],
    div: ['style'],
    li: ['style'],
    blockquote: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    h4: ['style'],
    h5: ['style'],
    h6: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['https'],
    video: ['cloudinary'],
    audio: ['cloudinary'],
  },
  allowProtocolRelative: false,
  parseStyleAttributes: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (_tagName, attribs) => {
      const href = safeLinkHref(attribs.href || '')
      if (!href) return { tagName: 'a', attribs: {} }
      const next: sanitizeHtml.Attributes = { href }
      if (/^https?:/i.test(href)) {
        next.target = '_blank'
        next.rel = 'noopener noreferrer'
      }
      return { tagName: 'a', attribs: next }
    },
    img: (_tagName, attribs) => {
      const src = safeImageSrc(attribs.src || '')
      if (!src) return { tagName: 'img', attribs: {} }
      const alt = (attribs.alt || '').replace(/[\r\n]+/g, ' ').slice(0, 200)
      return { tagName: 'img', attribs: alt ? { src, alt } : { src } }
    },
    video: (_tagName, attribs) => mediaAttributes('video', attribs),
    audio: (_tagName, attribs) => mediaAttributes('audio', attribs),
    '*': (tagName, attribs) => {
      const next = { ...attribs }
      const style = keepStyle(next.style)
      if (style) next.style = style
      else delete next.style
      return { tagName, attribs: next }
    },
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === 'img' || frame.tag === 'video' || frame.tag === 'audio') {
      return !frame.attribs.src
    }
    if (frame.tag === 'a' && !frame.attribs.href) return 'excludeTag'
    if (frame.tag === 'span' && !frame.attribs.style) return 'excludeTag'
    return false
  },
}

/** Stored HTML. Private video and voice stay as cloudinary:video refs. */
export function sanitizeRichHtml(html: string) {
  return sanitizeHtml(String(html || ''), SANITIZE_OPTIONS).trim()
}

/** Editor and learner HTML. Refs become /api/media URLs the browser can play. */
export function presentRichHtml(html: string) {
  const stored = sanitizeRichHtml(html)
  return stored.replace(/\bsrc="(cloudinary:video:[^"]*)"/g, (_match, ref: string) => {
    const decoded = ref
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
    const url = resolveMediaUrl(decoded)
    return url ? `src="${escapeAttr(url)}"` : 'src=""'
  })
}
