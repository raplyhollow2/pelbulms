import { tryCreateServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'

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
  require_identity_documents: boolean
  require_qualification: boolean
  require_student_id: boolean
  require_emergency_contact: boolean
  require_tos_consent: boolean
  collect_hear_about_us: boolean
  updated_at: string | null
}

export type RegistrationPolicy = {
  require_identity_documents: boolean
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
  require_identity_documents: true,
  require_qualification: false,
  require_student_id: false,
  require_emergency_contact: false,
  require_tos_consent: false,
  collect_hear_about_us: false,
  updated_at: null,
}

export function parsePlatformSettings(row: Record<string, unknown> | null | undefined): PlatformSettings {
  if (!row) return { ...DEFAULT_PLATFORM_SETTINGS }
  const featured = row.featured_course_ids
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
    require_identity_documents: row.require_identity_documents !== false,
    require_qualification: row.require_qualification === true,
    require_student_id: row.require_student_id === true,
    require_emergency_contact: row.require_emergency_contact === true,
    require_tos_consent: row.require_tos_consent === true,
    collect_hear_about_us: row.collect_hear_about_us === true,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export function toRegistrationPolicy(settings: PlatformSettings): RegistrationPolicy {
  return {
    require_identity_documents: settings.require_identity_documents,
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
    require_identity_documents: settings.require_identity_documents,
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const service = await tryCreateServiceClient()
    const client = service || (await createSupabaseServerClient())
    const { data, error } = await client
      .from('platform_settings' as any)
      .select('*')
      .eq('id', 'default')
      .maybeSingle()
    if (error || !data) return { ...DEFAULT_PLATFORM_SETTINGS }
    return parsePlatformSettings(data as unknown as Record<string, unknown>)
  } catch {
    return { ...DEFAULT_PLATFORM_SETTINGS }
  }
}
