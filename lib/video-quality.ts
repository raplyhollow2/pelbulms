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
  { value: 'auto', label: 'Auto (save data)', hint: 'Hero video prefers a smaller YouTube rendition.' },
  { value: 'high', label: 'High (recommended)', hint: 'Hero video prefers an HD YouTube rendition.' },
  { value: 'max', label: 'Maximum', hint: 'Hero video prefers the highest YouTube rendition.' },
]

export function parseVideoQuality(value: unknown): VideoQualityPreference {
  if (value === 'auto' || value === 'high' || value === 'max') return value
  return 'high'
}
