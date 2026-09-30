import { v2 as cloudinary } from 'cloudinary'
import type { VideoQualityPreference } from '@/lib/video-quality'
import { VIDEO_EAGER_TRANSFORMATION } from '@/lib/video-url'
import { tryCreateServiceClient } from '@/lib/supabase/server'

const CACHE_MS = 30_000

export type CloudinaryAccountSource = 'database' | 'environment'

export type CloudinaryAccount = {
  cloudName: string
  apiKey: string
  apiSecret: string
  source: CloudinaryAccountSource
}

export type CloudinaryConnectionStatus = {
  configured: boolean
  source: CloudinaryAccountSource | 'none'
  cloudName: string | null
  apiKeyLast4: string | null
  secretLast4: string | null
}

type CacheEntry = {
  at: number
  account: CloudinaryAccount | null
}

let cache: CacheEntry | null = null

function last4(value: string) {
  return value.trim().slice(-4)
}

function isRealCredential(cloudName: string, apiKey: string, apiSecret: string) {
  return Boolean(
    cloudName &&
      apiKey &&
      apiSecret &&
      cloudName !== 'your-cloud-name' &&
      apiKey !== 'your-api-key' &&
      apiSecret !== 'your-api-secret'
  )
}

function applyAccount(account: Pick<CloudinaryAccount, 'cloudName' | 'apiKey' | 'apiSecret'>) {
  cloudinary.config({
    cloud_name: account.cloudName,
    api_key: account.apiKey,
    api_secret: account.apiSecret,
    secure: true,
  })
}

function envAccount(): CloudinaryAccount | null {
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '').trim()
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim()
  if (!isRealCredential(cloudName, apiKey, apiSecret)) return null
  return { cloudName, apiKey, apiSecret, source: 'environment' }
}

async function databaseAccount(): Promise<CloudinaryAccount | null> {
  try {
    const service = await tryCreateServiceClient()
    if (!service) return null
    const { data, error } = await service
      .from('cloudinary_connection' as never)
      .select('cloud_name, api_key, api_secret')
      .eq('id', 'default')
      .maybeSingle()
    if (error || !data) return null
    const row = data as { cloud_name?: string; api_key?: string; api_secret?: string }
    const cloudName = String(row.cloud_name || '').trim()
    const apiKey = String(row.api_key || '').trim()
    const apiSecret = String(row.api_secret || '').trim()
    if (!isRealCredential(cloudName, apiKey, apiSecret)) return null
    return { cloudName, apiKey, apiSecret, source: 'database' }
  } catch {
    return null
  }
}

export function invalidateCloudinaryConfigCache() {
  cache = null
}

/** Saved Site administration account, then environment variables. */
export async function getCloudinaryAccount(): Promise<CloudinaryAccount | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    if (cache.account) applyAccount(cache.account)
    return cache.account
  }
  const account = (await databaseAccount()) || envAccount()
  cache = { at: Date.now(), account }
  if (account) applyAccount(account)
  return account
}

export async function getCloudinaryConnectionStatus(): Promise<CloudinaryConnectionStatus> {
  const account = await getCloudinaryAccount()
  if (!account) {
    return {
      configured: false,
      source: 'none',
      cloudName: null,
      apiKeyLast4: null,
      secretLast4: null,
    }
  }
  return {
    configured: true,
    source: account.source,
    cloudName: account.cloudName,
    apiKeyLast4: last4(account.apiKey),
    secretLast4: last4(account.apiSecret),
  }
}

export async function isCloudinaryConfigured(): Promise<boolean> {
  return Boolean(await getCloudinaryAccount())
}

/**
 * Ping Cloudinary with candidate credentials without keeping them as the live account.
 * Returns an error message, or null when the account accepts the credentials.
 */
export async function pingCloudinaryAccount(input: {
  cloudName: string
  apiKey: string
  apiSecret: string
}): Promise<string | null> {
  const previous = cloudinary.config()
  applyAccount(input)
  try {
    const result = await cloudinary.api.ping()
    if (result?.status && result.status !== 'ok') {
      return 'Cloudinary did not accept these credentials'
    }
    return null
  } catch (error: unknown) {
    const err = error as { error?: { message?: string }; message?: string }
    return err?.error?.message || err?.message || 'Cloudinary rejected these credentials'
  } finally {
    cloudinary.config(previous)
  }
}

export function cloudinaryClient(account: CloudinaryAccount) {
  applyAccount(account)
  return cloudinary
}

export type MediaResourceType = 'image' | 'video'

export function videoQualityTransformation(
  quality: VideoQualityPreference = 'high'
): Record<string, unknown>[] {
  // Not used for lesson playback. Any on-the-fly video transform here, including
  // q_auto and vc_h264, comes back as fragmented MP4 (ftypiso6) with no byte
  // ranges, and the native <video> element will not play it.
  switch (quality) {
    case 'auto':
      return [{ quality: 'auto:eco', fetch_format: 'mp4', video_codec: 'h264', height: 480, crop: 'limit' }]
    case 'max':
      return [{ quality: 'auto:best', fetch_format: 'mp4', video_codec: 'h264', height: 1080, crop: 'limit' }]
    case 'high':
    default:
      return [{ quality: 'auto:good', fetch_format: 'mp4', video_codec: 'h264', height: 720, crop: 'limit' }]
  }
}

function defaultTransformation(resourceType: MediaResourceType) {
  return resourceType === 'video'
    ? [{ ...VIDEO_EAGER_TRANSFORMATION }]
    : [{ fetch_format: 'auto', quality: 'auto' }]
}

export function signedUrl(
  publicId: string,
  account: CloudinaryAccount,
  opts: {
    resourceType?: MediaResourceType
    transformation?: Record<string, unknown>[]
    videoQuality?: VideoQualityPreference
    /** Original upload, still delivered as a progressive MP4 when possible. */
    raw?: boolean
    /** Set false only for the last-resort original container. */
    format?: false
  } = {}
): string {
  applyAccount(account)
  const { resourceType = 'image', transformation, videoQuality, raw = false, format } = opts
  // Video playback is the original progressive upload. On-the-fly transforms
  // (q_auto, height caps, vc_h264) are fragmented MP4 and will not play.
  const resolved =
    raw || resourceType === 'video'
      ? transformation
      : (transformation ??
        (videoQuality ? videoQualityTransformation(videoQuality) : defaultTransformation(resourceType)))
  const mp4 = resourceType === 'video' && format !== false
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    ...(mp4 ? { format: 'mp4' } : {}),
    ...(resolved ? { transformation: resolved } : {}),
  })
}

export function signUploadParams(
  params: Record<string, string | number>,
  account: CloudinaryAccount
): string {
  return cloudinary.utils.api_sign_request(params, account.apiSecret)
}
