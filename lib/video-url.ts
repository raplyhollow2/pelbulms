/**
 * Client-safe video URL helpers (YouTube, Google Drive, direct files).
 */

export const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024 // 1GB
export const MAX_VIDEO_UPLOAD_LABEL = '1GB'

/** Course covers / media library images — direct to Cloudinary (not via Next body). */
export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB
export const MAX_IMAGE_UPLOAD_LABEL = '25MB'

/** Must match signed upload params sent to Cloudinary (compress + cap 1080p). */
export const VIDEO_EAGER_TRANSFORM = 'q_auto,vc_auto,w_1920,h_1080,c_limit'

export function getYoutubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?&]+)/,
    /(?:youtube\.com\/embed\/)([^?&]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
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
