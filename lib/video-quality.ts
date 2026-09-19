/**
 * Client-safe video quality preference (no server imports).
 * Used by marketing settings UI and platform_settings parsers.
 */

export type VideoQualityPreference = 'auto' | 'high' | 'max'

export const VIDEO_QUALITY_OPTIONS: {
  value: VideoQualityPreference
  label: string
  hint: string
}[] = [
  { value: 'auto', label: 'Auto (save data)', hint: 'Smaller files; Cloudinary picks eco bitrate.' },
  { value: 'high', label: 'High (recommended)', hint: 'HD up to 720p with good visual quality.' },
  { value: 'max', label: 'Maximum', hint: 'Best quality up to 1080p; uses more bandwidth.' },
]

export function parseVideoQuality(value: unknown): VideoQualityPreference {
  if (value === 'auto' || value === 'high' || value === 'max') return value
  return 'high'
}
