/**
 * Media reference helpers (client-safe, no secrets).
 *
 * Uploaded private assets are stored in the database as a compact reference:
 *   "cloudinary:image:<public_id>"  or  "cloudinary:video:<public_id>"
 *
 * Legacy values are plain URLs (Supabase public URLs, dicebear avatars, etc.)
 * and are returned unchanged so nothing breaks during the transition.
 */

const CLOUDINARY_PREFIX = 'cloudinary:'

// Remote course covers that are either blocked (403) or too busy to read as a course picture.
const COVER_OVERRIDES: [string, string][] = [
  ['Business_Model_Canvas_Certiprof', '/covers/business-models.jpg'],
  ['mujer-ejecutiva-panel-grafico', '/covers/ai-for-business.jpg'],
]

export function makeMediaRef(type: 'image' | 'video', publicId: string): string {
  return `${CLOUDINARY_PREFIX}${type}:${publicId}`
}

export function parseMediaRef(
  ref?: string | null
): { type: 'image' | 'video'; publicId: string } | null {
  if (!ref || !ref.startsWith(CLOUDINARY_PREFIX)) return null
  const rest = ref.slice(CLOUDINARY_PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep === -1) return null
  const type = rest.slice(0, sep) === 'video' ? 'video' : 'image'
  const publicId = rest.slice(sep + 1)
  if (!publicId) return null
  return { type, publicId }
}

/**
 * Resolve a stored media reference into a URL usable in <img>/<video>.
 * Cloudinary refs are routed through the authenticated /api/media proxy;
 * everything else is returned as-is.
 */
export function resolveMediaUrl(ref?: string | null): string | null {
  if (!ref) return null
  for (const [needle, local] of COVER_OVERRIDES) {
    if (ref.includes(needle)) return local
  }
  const parsed = parseMediaRef(ref)
  if (!parsed) return ref
  return `/api/media/${parsed.publicId}?type=${parsed.type}`
}

/** Downscale a Cloudinary delivery URL. Other URLs are returned unchanged. */
export function cloudinaryDisplayUrl(url: string, width: number): string {
  const marker = '/image/upload/'
  const at = url.indexOf(marker)
  if (at === -1) return url
  const rest = url.slice(at + marker.length)
  if (/^[a-z]_/.test(rest)) return url
  const px = Math.max(64, Math.round(width))
  return `${url.slice(0, at + marker.length)}f_auto,q_auto,c_limit,w_${px}/${rest}`
}
