import { v2 as cloudinary } from 'cloudinary'

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
}

/**
 * True only when real Cloudinary credentials are present (not the placeholder
 * values shipped in .env.local). Callers should fall back to another store
 * (e.g. Supabase private buckets) when this is false.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    cloudName &&
      apiKey &&
      apiSecret &&
      cloudName !== 'your-cloud-name' &&
      apiKey !== 'your-api-key' &&
      apiSecret !== 'your-api-secret'
  )
}

export type MediaResourceType = 'image' | 'video'

/**
 * Default delivery transformations. These compress the asset heavily while
 * keeping it visually high quality (the same idea streaming platforms use):
 *   - video: q_auto lets Cloudinary pick the best codec/bitrate per request
 *   - image: f_auto + q_auto serves modern formats (AVIF/WebP) at auto quality
 * Cloudinary transcodes once and caches the derived asset on its CDN.
 */
function defaultTransformation(resourceType: MediaResourceType) {
  return resourceType === 'video'
    ? [{ quality: 'auto', video_codec: 'auto' }]
    : [{ fetch_format: 'auto', quality: 'auto' }]
}

/**
 * Build a signed delivery URL for a private ("authenticated") Cloudinary asset.
 * The URL carries a signature derived from the API secret, so it cannot be
 * forged and the asset has no public, guessable URL. This URL is only ever used
 * server-side (the /api/media proxy fetches it), so it is never exposed to the
 * browser.
 */
export function signedUrl(
  publicId: string,
  opts: {
    resourceType?: MediaResourceType
    transformation?: Record<string, unknown>[]
  } = {}
): string {
  const { resourceType = 'image', transformation } = opts
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    transformation: transformation ?? defaultTransformation(resourceType),
  })
}

/**
 * Sign the parameters for a direct browser upload of an authenticated asset.
 */
export function signUploadParams(params: Record<string, string | number>): string {
  return cloudinary.utils.api_sign_request(params, apiSecret as string)
}

export { cloudinary, cloudName, apiKey }
