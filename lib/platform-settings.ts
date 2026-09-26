import { tryCreateServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'
import {
  DEFAULT_HERO_CTA_PRIMARY,
  DEFAULT_HERO_ROTATING_WORDS,
  DEFAULT_HERO_VIDEO_URL,
  DEFAULT_LANDING_STATS,
  parseHeroRotatingWords,
  parseLandingFaq,
  parseLandingFeatures,
  parseLandingSectionTitles,
  parseLandingStats,
  parseLandingSteps,
  type LandingFaqItem,
  type LandingFeature,
  type LandingSectionTitles,
  type LandingStat,
  type LandingStep,
} from '@/lib/landing-content'
import {
  parseVideoQuality,
  type VideoQualityPreference,
} from '@/lib/video-quality'

export type { VideoQualityPreference } from '@/lib/video-quality'
export { VIDEO_QUALITY_OPTIONS, parseVideoQuality } from '@/lib/video-quality'

export type PlatformSettings = {
  id: string
  site_name: string
  tagline: string | null
  support_email: string | null
  landing_headline: string | null
  landing_description: string | null
  public_catalog: boolean
  featured_course_ids: string[]
  maintenance_mode: boolean
  /** Derived: CID or identity photo is required. */
  require_identity_documents: boolean
  require_cid: boolean
  require_identity_photo: boolean
  require_qualification: boolean
  require_student_id: boolean
  require_emergency_contact: boolean
  require_tos_consent: boolean
  collect_hear_about_us: boolean
  hero_video_url: string | null
  /** Seconds into the video where the hero loop starts; null = 0 */
  hero_video_start_seconds: number | null
  /** Seconds where the hero loop ends and restarts; null = full video */
  hero_video_end_seconds: number | null
  /**
   * Lesson + marketing video delivery preference.
   * auto = smaller files · high = HD default · max = best bitrate
   */
  video_quality: VideoQualityPreference
  hero_rotating_words: string[]
  hero_cta_primary_label: string | null
  landing_stats: LandingStat[]
  /** null = use built-in defaults (KYC-aware on homepage) */
  landing_features: LandingFeature[] | null
  landing_steps: LandingStep[] | null
  landing_faq: LandingFaqItem[] | null
  landing_section_titles: LandingSectionTitles
  updated_at: string | null
}

export type RegistrationPolicy = {
  /** True when CID or an identity photo is required. Students then wait for review. */
  require_identity_documents: boolean
  require_cid: boolean
  require_identity_photo: boolean
  require_qualification: boolean
  require_student_id: boolean
  require_emergency_contact: boolean
  require_tos_consent: boolean
  collect_hear_about_us: boolean
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: 'default',
  site_name: 'Pelbu LMS',
  tagline: "Bhutan's private learning platform",
  support_email: null,
  landing_headline: null,
  landing_description: null,
  public_catalog: true,
  featured_course_ids: [],
  maintenance_mode: false,
  require_identity_documents: false,
  require_cid: false,
  require_identity_photo: false,
  require_qualification: false,
  require_student_id: false,
  require_emergency_contact: false,
  require_tos_consent: false,
  collect_hear_about_us: false,
  hero_video_url: DEFAULT_HERO_VIDEO_URL,
  hero_video_start_seconds: null,
  hero_video_end_seconds: null,
  video_quality: 'high',
  hero_rotating_words: [...DEFAULT_HERO_ROTATING_WORDS],
  hero_cta_primary_label: DEFAULT_HERO_CTA_PRIMARY,
  landing_stats: [...DEFAULT_LANDING_STATS],
  landing_features: null,
  landing_steps: null,
  landing_faq: null,
  landing_section_titles: {},
  updated_at: null,
}

export function parsePlatformSettings(row: Record<string, unknown> | null | undefined): PlatformSettings {
  if (!row) return { ...DEFAULT_PLATFORM_SETTINGS, hero_rotating_words: [...DEFAULT_HERO_ROTATING_WORDS], landing_stats: [...DEFAULT_LANDING_STATS] }
  const featured = row.featured_course_ids
  const heroUrl =
    typeof row.hero_video_url === 'string' && row.hero_video_url.trim()
      ? row.hero_video_url.trim()
      : DEFAULT_HERO_VIDEO_URL
  const cta =
    typeof row.hero_cta_primary_label === 'string' && row.hero_cta_primary_label.trim()
      ? row.hero_cta_primary_label.trim()
      : DEFAULT_HERO_CTA_PRIMARY
  const startSec = parseOptionalNonNegInt(row.hero_video_start_seconds)
  const endSec = parseOptionalPositiveInt(row.hero_video_end_seconds)
  const clip =
    endSec != null && startSec != null && endSec <= startSec
      ? { start: startSec, end: null as number | null }
      : { start: startSec, end: endSec }

  return {
    id: 'default',
    site_name: typeof row.site_name === 'string' && row.site_name.trim()
      ? row.site_name.trim()
      : DEFAULT_PLATFORM_SETTINGS.site_name,
    tagline: typeof row.tagline === 'string' ? row.tagline : DEFAULT_PLATFORM_SETTINGS.tagline,
    support_email: typeof row.support_email === 'string' ? row.support_email : null,
    landing_headline: typeof row.landing_headline === 'string' ? row.landing_headline : null,
    landing_description: typeof row.landing_description === 'string' ? row.landing_description : null,
    public_catalog: row.public_catalog !== false,
    featured_course_ids: Array.isArray(featured)
      ? featured.filter((id): id is string => typeof id === 'string')
      : [],
    maintenance_mode: row.maintenance_mode === true,
    ...parseIdentityFlags(row),
    require_qualification: row.require_qualification === true,
    require_student_id: row.require_student_id === true,
    require_emergency_contact: row.require_emergency_contact === true,
    require_tos_consent: row.require_tos_consent === true,
    collect_hear_about_us: row.collect_hear_about_us === true,
    hero_video_url: heroUrl,
    hero_video_start_seconds: clip.start,
    hero_video_end_seconds: clip.end,
    video_quality: parseVideoQuality(row.video_quality),
    hero_rotating_words: parseHeroRotatingWords(row.hero_rotating_words),
    hero_cta_primary_label: cta,
    landing_stats: parseLandingStats(row.landing_stats),
    landing_features: parseLandingFeatures(row.landing_features),
    landing_steps: parseLandingSteps(row.landing_steps),
    landing_faq: parseLandingFaq(row.landing_faq),
    landing_section_titles: parseLandingSectionTitles(row.landing_section_titles),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

function parseIdentityFlags(row: Record<string, unknown>) {
  const legacy = row.require_identity_documents !== false
  const hasCid = typeof row.require_cid === 'boolean'
  const hasPhoto = typeof row.require_identity_photo === 'boolean'
  const require_cid = hasCid ? row.require_cid === true : legacy
  const require_identity_photo = hasPhoto ? row.require_identity_photo === true : legacy
  return {
    require_cid,
    require_identity_photo,
    require_identity_documents: require_cid || require_identity_photo,
  }
}

function parseOptionalNonNegInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function parseOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export function toRegistrationPolicy(settings: PlatformSettings): RegistrationPolicy {
  return {
    require_identity_documents: settings.require_cid || settings.require_identity_photo,
    require_cid: settings.require_cid,
    require_identity_photo: settings.require_identity_photo,
    require_qualification: settings.require_qualification,
    require_student_id: settings.require_student_id,
    require_emergency_contact: settings.require_emergency_contact,
    require_tos_consent: settings.require_tos_consent,
    collect_hear_about_us: settings.collect_hear_about_us,
  }
}

export function toPublicSite(settings: PlatformSettings) {
  return {
    site_name: settings.site_name,
    tagline: settings.tagline,
    support_email: settings.support_email,
    landing_headline: settings.landing_headline,
    landing_description: settings.landing_description,
    public_catalog: settings.public_catalog,
    featured_course_ids: settings.featured_course_ids,
    maintenance_mode: settings.maintenance_mode,
    require_identity_documents: settings.require_cid || settings.require_identity_photo,
    hero_video_url: settings.hero_video_url,
    hero_video_start_seconds: settings.hero_video_start_seconds,
    hero_video_end_seconds: settings.hero_video_end_seconds,
    video_quality: settings.video_quality,
    hero_rotating_words: settings.hero_rotating_words,
    hero_cta_primary_label: settings.hero_cta_primary_label,
    landing_stats: settings.landing_stats,
    landing_features: settings.landing_features,
    landing_steps: settings.landing_steps,
    landing_faq: settings.landing_faq,
    landing_section_titles: settings.landing_section_titles,
  }
}

const SETTINGS_CACHE_MS = 60_000
let settingsCache: { at: number; value: PlatformSettings } | null = null

export function invalidatePlatformSettingsCache() {
  settingsCache = null
}

function defaultSettings(): PlatformSettings {
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    hero_rotating_words: [...DEFAULT_HERO_ROTATING_WORDS],
    landing_stats: [...DEFAULT_LANDING_STATS],
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) {
    return settingsCache.value
  }
  try {
    const service = await tryCreateServiceClient()
    const client = service || (await createSupabaseServerClient())
    const { data, error } = await client
      .from('platform_settings' as any)
      .select('*')
      .eq('id', 'default')
      .maybeSingle()
    const value =
      error || !data
        ? defaultSettings()
        : parsePlatformSettings(data as unknown as Record<string, unknown>)
    settingsCache = { at: Date.now(), value }
    return value
  } catch {
    return defaultSettings()
  }
}
