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
  const parsed = parseMediaRef(ref)
  if (!parsed) return ref
  return `/api/media/${parsed.publicId}?type=${parsed.type}`
}
