/**
 * Client-safe video URL helpers (YouTube, Google Drive, direct files).
 */

export const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1GB
export const MAX_VIDEO_UPLOAD_LABEL = '1GB'

/** Course covers / media library images — direct to Cloudinary (not via Next body). */
export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB
export const MAX_IMAGE_UPLOAD_LABEL = '25MB'

/**
 * Upload-time derivative only. Do not request this URL for `<video>` playback:
 * `q_auto` on video is packaged as fragmented MP4 (`ftypiso6`), which the
 * native player cannot play. Playback uses the original progressive upload.
 */
export const VIDEO_EAGER_TRANSFORM = 'c_limit,f_mp4,h_1080,q_auto,vc_h264,w_1920'

/** Same derivative Cloudinary may build at upload time. Not used for playback. */
export const VIDEO_EAGER_TRANSFORMATION = {
  crop: 'limit',
  fetch_format: 'mp4',
  height: 1080,
  quality: 'auto',
  video_codec: 'h264',
  width: 1920,
} as const

/** Required on every YouTube iframe or the embed shows Error 153. */
export const YOUTUBE_EMBED_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share'

/**
 * Fills a `relative aspect-video overflow-hidden` parent.
 * The IFrame API overwrites this with pixel width/height; `pinYoutubeIframe` clears those.
 */
export const YOUTUBE_IFRAME_CLASS = 'absolute inset-0 h-full w-full border-0 object-cover'

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/

export function getYoutubeId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProto)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id && YOUTUBE_ID.test(id) ? id : null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery
      const parts = parsed.pathname.split('/').filter(Boolean)
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i] === 'embed' || parts[i] === 'shorts' || parts[i] === 'live' || parts[i] === 'v') {
          const id = parts[i + 1]
          if (id && YOUTUBE_ID.test(id)) return id
        }
      }
    }
  } catch {
    /* fall through to the regex */
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{6,})/
  )
  return match?.[1] || null
}

export function youtubeEmbedSrc(
  id: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === '') continue
    query.set(key, String(value))
  }
  const qs = query.toString()
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`
}

const CONTAINED_STYLE_PROPS = [
  'position',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'max-width',
  'max-height',
  'transform',
  'object-fit',
  'border',
] as const

/** Center a 16:9 picture in its parent. */
export function fitContainedMedia(el: HTMLElement) {
  const parent = el.parentElement
  if (!parent) return
  const boxW = parent.clientWidth
  const boxH = parent.clientHeight
  if (boxW < 2 || boxH < 2) return

  const ratio = 16 / 9
  let w = boxW
  let h = w / ratio
  if (h > boxH) {
    h = boxH
    w = h * ratio
  }
  w = Math.round(w)
  h = Math.round(h)
  const x = Math.round((boxW - w) / 2)
  const y = Math.round((boxH - h) / 2)

  el.removeAttribute('width')
  el.removeAttribute('height')
  el.style.setProperty('position', 'absolute', 'important')
  el.style.setProperty('inset', 'auto', 'important')
  el.style.setProperty('top', `${y}px`, 'important')
  el.style.setProperty('left', `${x}px`, 'important')
  el.style.setProperty('right', 'auto', 'important')
  el.style.setProperty('bottom', 'auto', 'important')
  el.style.setProperty('width', `${w}px`, 'important')
  el.style.setProperty('height', `${h}px`, 'important')
  el.style.setProperty('max-width', 'none', 'important')
  el.style.setProperty('max-height', 'none', 'important')
  el.style.setProperty('transform', 'none', 'important')
  el.style.setProperty('object-fit', 'contain', 'important')
  el.style.setProperty('border', '0', 'important')
}

export function clearContainedMedia(el: HTMLElement) {
  for (const prop of CONTAINED_STYLE_PROPS) el.style.removeProperty(prop)
}

/** Edge-to-edge picture inside the fullscreen frame. */
export function fitFilledMedia(el: HTMLElement) {
  el.removeAttribute('width')
  el.removeAttribute('height')
  el.style.setProperty('position', 'absolute', 'important')
  el.style.setProperty('inset', '0', 'important')
  el.style.setProperty('width', '100%', 'important')
  el.style.setProperty('height', '100%', 'important')
  el.style.setProperty('max-width', 'none', 'important')
  el.style.setProperty('max-height', 'none', 'important')
  el.style.setProperty('transform', 'none', 'important')
  el.style.setProperty('object-fit', 'contain', 'important')
  el.style.setProperty('border', '0', 'important')
}

/** Drop pixel width/height and lock the iframe to its 16:9 parent. */
export function fitYoutubeIframe(iframe: HTMLIFrameElement) {
  if (iframe.closest('[data-landscape-fallback]')) {
    fitFilledMedia(iframe)
    return
  }
  iframe.removeAttribute('width')
  iframe.removeAttribute('height')
  iframe.style.setProperty('position', 'absolute', 'important')
  iframe.style.setProperty('inset', '0', 'important')
  iframe.style.setProperty('width', '100%', 'important')
  iframe.style.setProperty('height', '100%', 'important')
  iframe.style.setProperty('max-width', '100%', 'important')
  iframe.style.setProperty('max-height', '100%', 'important')
  iframe.style.setProperty('object-fit', 'cover', 'important')
  iframe.style.setProperty('border', '0', 'important')
}

const youtubePins = new WeakSet<HTMLIFrameElement>()

/**
 * Keep clearing the pixel size the IFrame API writes back after attach / onReady.
 * Safe to call more than once.
 */
export function pinYoutubeIframe(iframe: HTMLIFrameElement) {
  fitYoutubeIframe(iframe)
  if (youtubePins.has(iframe)) return () => {}
  youtubePins.add(iframe)

  let applying = false
  const apply = () => {
    applying = true
    fitYoutubeIframe(iframe)
    applying = false
  }
  const locked = () => {
    if (iframe.getAttribute('width') || iframe.getAttribute('height')) return false
    if (iframe.closest('[data-landscape-fallback]')) {
      return (
        iframe.style.getPropertyValue('object-fit') === 'contain' &&
        iframe.style.getPropertyValue('width') === '100%' &&
        iframe.style.getPropertyPriority('width') === 'important'
      )
    }
    if (iframe.style.getPropertyValue('width') !== '100%') return false
    if (iframe.style.getPropertyValue('height') !== '100%') return false
    if (iframe.style.getPropertyPriority('width') !== 'important') return false
    if (iframe.style.getPropertyPriority('height') !== 'important') return false
    return iframe.style.getPropertyValue('position') === 'absolute'
  }

  const observer = new MutationObserver(() => {
    if (applying) return
    if (!iframe.isConnected) {
      observer.disconnect()
      youtubePins.delete(iframe)
      return
    }
    if (!locked()) apply()
  })
  observer.observe(iframe, { attributes: true, attributeFilter: ['style', 'width', 'height'] })

  const parent = iframe.parentNode
  const parentObserver =
    parent &&
    new MutationObserver(() => {
      if (!iframe.isConnected) {
        observer.disconnect()
        parentObserver?.disconnect()
        youtubePins.delete(iframe)
      }
    })
  if (parent && parentObserver) parentObserver.observe(parent, { childList: true })

  return () => {
    observer.disconnect()
    parentObserver?.disconnect()
    youtubePins.delete(iframe)
  }
}

/**
 * Iframe the IFrame API can attach to. Referrer policy is set before src loads.
 * `contain` locks the player to a 16:9 column frame. The homepage hero leaves
 * this off so its own cover-crop box stays in charge of size.
 */
export function createYoutubeIframe(
  videoId: string,
  playerVars: Record<string, string | number | boolean | null | undefined> = {},
  options?: { contain?: boolean }
) {
  const iframe = document.createElement('iframe')
  iframe.title = 'YouTube'
  iframe.className = options?.contain ? YOUTUBE_IFRAME_CLASS : 'h-full w-full border-0'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.allow = YOUTUBE_EMBED_ALLOW
  iframe.allowFullscreen = true
  iframe.src = youtubeEmbedSrc(videoId, {
    ...playerVars,
    enablejsapi: 1,
    origin: window.location.origin,
  })
  if (options?.contain) {
    fitYoutubeIframe(iframe)
    queueMicrotask(() => {
      if (iframe.isConnected) pinYoutubeIframe(iframe)
    })
  }
  return iframe
}

export function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (!/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(u.hostname)) {
      return null
    }
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/)
    if (fileMatch?.[1]) return fileMatch[1]
    const id = u.searchParams.get('id')
    if (id) return id
  } catch {
    const fileMatch = url.match(/\/file\/d\/([^/]+)/)
    if (fileMatch?.[1]) return fileMatch[1]
    const idMatch = url.match(/[?&]id=([^&]+)/)
    if (idMatch?.[1]) return idMatch[1]
  }
  return null
}

/** In-LMS embed URL — plays inside the player, not as a Drive page navigation. */
export function getGoogleDriveEmbedUrl(urlOrId: string): string | null {
  const id = urlOrId.includes('/') || urlOrId.includes('?')
    ? getGoogleDriveFileId(urlOrId)
    : urlOrId
  if (!id) return null
  return `https://drive.google.com/file/d/${id}/preview`
}

export function isGoogleDriveUrl(url: string): boolean {
  return Boolean(getGoogleDriveFileId(url))
}

export function isDirectVideoFile(url: string): boolean {
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) return true
  if (url.includes('/api/media/') && /[?&]type=video/.test(url)) return true
  return false
}

export const DRIVE_SHARE_HINT =
  'Share the file as “Anyone with the link” (Viewer) so students can watch inside the LMS without opening Drive.'
