// @ts-nocheck - platform_settings not in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { enforceCapability, CAP } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { getAdminDb } from '@/lib/supabase/server'
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
  type PlatformSettings,
  invalidatePlatformSettingsCache,
} from '@/lib/platform-settings'
import {
  normalizeLandingCampusInput,
  normalizeLandingFaqInput,
  normalizeLandingFeaturesInput,
  normalizeLandingGalleryInput,
  normalizeLandingQuotesInput,
  normalizeLandingSectionTitlesInput,
  normalizeLandingStatsInput,
  normalizeHeroSlidesInput,
  normalizeLandingStepsInput,
  parseHeroRotatingWords,
  parseLandingSectionTitles,
  type HeroSlide,
} from '@/lib/landing-content'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

function bustPublicSiteCache() {
  invalidatePlatformSettingsCache()
  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/auth/login')
  revalidatePath('/auth/register')
  revalidatePath('/api/public/site')
}

const SITE_FIELDS = ['site_name', 'tagline', 'support_email', 'maintenance_mode'] as const
const REGISTRATION_FIELDS = [
  'require_identity_documents',
  'require_cid',
  'require_identity_photo',
  'require_qualification',
  'require_student_id',
  'require_emergency_contact',
  'require_tos_consent',
  'collect_hear_about_us',
] as const
const MARKETING_FIELDS = [
  'landing_headline',
  'landing_description',
  'hero_video_url',
  'hero_cta_primary_label',
  'hero_cta_secondary_label',
  'hero_image_url',
  'hero_glass_opacity',
  'featured_course_ids',
  'public_catalog',
  'hero_rotating_words',
  'hero_video_start_seconds',
  'hero_video_end_seconds',
  'video_quality',
  'landing_stats',
  'landing_features',
  'landing_steps',
  'landing_faq',
  'landing_campus',
  'landing_quotes',
  'landing_gallery',
  'landing_section_titles',
  'mascot_image_url',
  'hero_slides',
] as const

function bodyTouches(body: Record<string, unknown>, fields: readonly string[]) {
  return fields.some((key) => body[key] !== undefined)
}

async function requireSettingsRead(request: NextRequest) {
  return enforceCapability(
    request,
    [
      CAP.SETTINGS_VIEW,
      CAP.SETTINGS_SITE_VIEW,
      CAP.SETTINGS_REGISTRATION_VIEW,
      CAP.SETTINGS_MARKETING_VIEW,
    ],
    ADMIN_ROLES
  )
}

async function requireSettingsWrite(request: NextRequest, body: Record<string, unknown>) {
  const needed: string[] = []
  if (bodyTouches(body, SITE_FIELDS)) needed.push(CAP.SETTINGS_SITE_EDIT)
  if (bodyTouches(body, REGISTRATION_FIELDS)) needed.push(CAP.SETTINGS_REGISTRATION_EDIT)
  if (bodyTouches(body, MARKETING_FIELDS)) needed.push(CAP.SETTINGS_MARKETING_EDIT)
  const known = new Set<string>([...SITE_FIELDS, ...REGISTRATION_FIELDS, ...MARKETING_FIELDS])
  if (Object.keys(body).some((key) => !known.has(key))) needed.push(CAP.SETTINGS_EDIT)
  if (needed.length === 0) needed.push(CAP.SETTINGS_EDIT)

  let last = await enforceCapability(request, needed[0], ADMIN_ROLES)
  if (!last.hasAccess) return last
  for (const key of needed.slice(1)) {
    last = await enforceCapability(request, key, ADMIN_ROLES)
    if (!last.hasAccess) return last
  }
  return last
}

const BOOLEAN_KEYS = [
  'public_catalog',
  'maintenance_mode',
  'require_identity_documents',
  'require_cid',
  'require_identity_photo',
  'require_qualification',
  'require_student_id',
  'require_emergency_contact',
  'require_tos_consent',
  'collect_hear_about_us',
] as const

const STRING_KEYS = [
  'site_name',
  'tagline',
  'support_email',
  'landing_headline',
  'landing_description',
  'hero_video_url',
  'hero_cta_primary_label',
] as const

/**
 * GET /api/admin/settings
 * Admin or superadmin. Returns platform settings plus courses for featured picking.
 */
export async function GET(request: NextRequest) {
  const rbac = await requireSettingsRead(request)
  if (!rbac.hasAccess) return denied(rbac)

  const service = await getAdminDb()
  const { data, error } = await service
    .from('platform_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const settings = parsePlatformSettings(data as Record<string, unknown> | null)

  const { data: courses } = await service
    .from('courses')
    .select('id, title, is_published')
    .order('title', { ascending: true })

  return NextResponse.json({
    settings,
    courses: (courses || []).map((c: { id: string; title: string; is_published: boolean | null }) => ({
      id: c.id,
      title: c.title,
      is_published: !!c.is_published,
    })),
  })
}

/**
 * PATCH /api/admin/settings
 * Admin or superadmin. Partial update of the singleton row.
 */
export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const rbac = await requireSettingsWrite(request, body)
  if (!rbac.hasAccess) return denied(rbac)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const key of STRING_KEYS) {
    if (body[key] === undefined) continue
    if (body[key] === null) {
      updates[key] = null
      continue
    }
    if (typeof body[key] !== 'string') {
      return NextResponse.json({ error: `${key} must be a string` }, { status: 400 })
    }
    const value = body[key].trim()
    if (key === 'site_name' && !value) {
      return NextResponse.json({ error: 'Site name cannot be empty' }, { status: 400 })
    }
    updates[key] = value || null
  }

  for (const key of BOOLEAN_KEYS) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'boolean') {
      return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 })
    }
    updates[key] = body[key]
  }

  if (body.featured_course_ids !== undefined) {
    if (!Array.isArray(body.featured_course_ids)) {
      return NextResponse.json({ error: 'featured_course_ids must be an array' }, { status: 400 })
    }
    const ids = body.featured_course_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    updates.featured_course_ids = ids
  }

  if (body.hero_rotating_words !== undefined) {
    if (typeof body.hero_rotating_words === 'string' || Array.isArray(body.hero_rotating_words)) {
      updates.hero_rotating_words = parseHeroRotatingWords(body.hero_rotating_words)
    } else {
      return NextResponse.json({ error: 'hero_rotating_words must be a string or array' }, { status: 400 })
    }
  }

  for (const key of ['hero_video_start_seconds', 'hero_video_end_seconds'] as const) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === '') {
      updates[key] = null
      continue
    }
    const n = typeof body[key] === 'number' ? body[key] : Number(body[key])
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return NextResponse.json({ error: `${key} must be an integer or null` }, { status: 400 })
    }
    if (key === 'hero_video_start_seconds' && n < 0) {
      return NextResponse.json({ error: 'hero_video_start_seconds must be >= 0' }, { status: 400 })
    }
    if (key === 'hero_video_end_seconds' && n <= 0) {
      return NextResponse.json({ error: 'hero_video_end_seconds must be > 0' }, { status: 400 })
    }
    updates[key] = n
  }

  if (body.video_quality !== undefined) {
    if (body.video_quality !== 'auto' && body.video_quality !== 'high' && body.video_quality !== 'max') {
      return NextResponse.json(
        { error: 'video_quality must be auto, high, or max' },
        { status: 400 }
      )
    }
    updates.video_quality = body.video_quality
  }

  const nextStart =
    updates.hero_video_start_seconds !== undefined
      ? (updates.hero_video_start_seconds as number | null)
      : undefined
  const nextEnd =
    updates.hero_video_end_seconds !== undefined
      ? (updates.hero_video_end_seconds as number | null)
      : undefined

  if (body.landing_stats !== undefined) {
    const stats = normalizeLandingStatsInput(body.landing_stats)
    if (stats === null) {
      return NextResponse.json({ error: 'landing_stats must be an array of {value, label}' }, { status: 400 })
    }
    updates.landing_stats = stats
  }

  if (body.landing_features !== undefined) {
    const features = normalizeLandingFeaturesInput(body.landing_features)
    if (features === null) {
      return NextResponse.json(
        { error: 'landing_features must be an array of {title, description, icon}' },
        { status: 400 }
      )
    }
    updates.landing_features = features
  }

  if (body.landing_steps !== undefined) {
    const steps = normalizeLandingStepsInput(body.landing_steps)
    if (steps === null) {
      return NextResponse.json(
        { error: 'landing_steps must be an array of {title, description, icon}' },
        { status: 400 }
      )
    }
    updates.landing_steps = steps
  }

  if (body.landing_faq !== undefined) {
    const faq = normalizeLandingFaqInput(body.landing_faq)
    if (faq === null) {
      return NextResponse.json(
        { error: 'landing_faq must be an array of {question, answer}' },
        { status: 400 }
      )
    }
    updates.landing_faq = faq
  }

  if (body.landing_section_titles !== undefined) {
    const titles = normalizeLandingSectionTitlesInput(body.landing_section_titles)
    if (titles === null) {
      return NextResponse.json({ error: 'landing_section_titles must be an object' }, { status: 400 })
    }
    updates.landing_section_titles = titles
  }

  if (body.landing_campus !== undefined) {
    const campus = normalizeLandingCampusInput(body.landing_campus)
    if (campus === null) {
      return NextResponse.json(
        { error: 'landing_campus must be an array of {image_url, title, description}' },
        { status: 400 }
      )
    }
    updates.landing_campus = campus
  }

  if (body.landing_quotes !== undefined) {
    const quotes = normalizeLandingQuotesInput(body.landing_quotes)
    if (quotes === null) {
      return NextResponse.json(
        { error: 'landing_quotes must be an array of {quote, name, role, stars}' },
        { status: 400 }
      )
    }
    updates.landing_quotes = quotes
  }

  if (body.landing_gallery !== undefined) {
    const gallery = normalizeLandingGalleryInput(body.landing_gallery)
    if (gallery === null) {
      return NextResponse.json({ error: 'landing_gallery must be an array of image URLs' }, { status: 400 })
    }
    updates.landing_gallery = gallery
  }

  if (body.hero_cta_secondary_label !== undefined) {
    updates.hero_cta_secondary_label =
      typeof body.hero_cta_secondary_label === 'string' && body.hero_cta_secondary_label.trim()
        ? body.hero_cta_secondary_label.trim()
        : null
  }

  if (body.hero_image_url !== undefined) {
    updates.hero_image_url =
      typeof body.hero_image_url === 'string' && body.hero_image_url.trim()
        ? body.hero_image_url.trim()
        : null
  }

  let mascotUpdate: string | null | undefined
  if (body.mascot_image_url !== undefined) {
    if (body.mascot_image_url !== null && typeof body.mascot_image_url !== 'string') {
      return NextResponse.json({ error: 'mascot_image_url must be a string' }, { status: 400 })
    }
    mascotUpdate =
      typeof body.mascot_image_url === 'string' && body.mascot_image_url.trim()
        ? body.mascot_image_url.trim().slice(0, 2000)
        : null
  }

  let heroSlidesUpdate: HeroSlide[] | undefined
  if (body.hero_slides !== undefined) {
    const slides = normalizeHeroSlidesInput(body.hero_slides)
    if (slides === null) {
      return NextResponse.json(
        { error: 'hero_slides must be an array of {title, kicker, accent, body, layout, items}' },
        { status: 400 }
      )
    }
    heroSlidesUpdate = slides
  }

  if (body.hero_glass_opacity !== undefined) {
    const n = typeof body.hero_glass_opacity === 'number' ? body.hero_glass_opacity : Number(body.hero_glass_opacity)
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: 'hero_glass_opacity must be a number from 20 to 90' }, { status: 400 })
    }
    updates.hero_glass_opacity = Math.min(90, Math.max(20, Math.round(n)))
  }

  const service = await getAdminDb()

  if (
    mascotUpdate !== undefined ||
    heroSlidesUpdate !== undefined ||
    updates.landing_section_titles !== undefined
  ) {
    const { data: currentSections } = await service
      .from('platform_settings')
      .select('landing_section_titles')
      .eq('id', 'default')
      .maybeSingle()
    const current =
      currentSections?.landing_section_titles &&
      typeof currentSections.landing_section_titles === 'object' &&
      !Array.isArray(currentSections.landing_section_titles)
        ? (currentSections.landing_section_titles as Record<string, unknown>)
        : {}
    const titles =
      updates.landing_section_titles !== undefined
        ? (updates.landing_section_titles as Record<string, unknown>)
        : parseLandingSectionTitles(current)
    const next: Record<string, unknown> = { ...titles }
    if (mascotUpdate !== undefined) {
      if (mascotUpdate) next.mascot_image_url = mascotUpdate
    } else if (typeof current.mascot_image_url === 'string' && current.mascot_image_url.trim()) {
      next.mascot_image_url = current.mascot_image_url.trim()
    }
    if (heroSlidesUpdate !== undefined) {
      next.hero_slides = heroSlidesUpdate
    } else if (Array.isArray(current.hero_slides)) {
      next.hero_slides = current.hero_slides
    }
    updates.landing_section_titles = next
  }

  if (
    typeof updates.require_cid === 'boolean' ||
    typeof updates.require_identity_photo === 'boolean' ||
    typeof updates.require_identity_documents === 'boolean'
  ) {
    const legacyOnly =
      typeof updates.require_identity_documents === 'boolean' &&
      updates.require_cid === undefined &&
      updates.require_identity_photo === undefined
    if (legacyOnly) {
      updates.require_cid = updates.require_identity_documents
      updates.require_identity_photo = updates.require_identity_documents
    } else {
      const { data: currentFlags } = await service
        .from('platform_settings')
        .select('require_cid, require_identity_photo')
        .eq('id', 'default')
        .maybeSingle()
      const cid =
        typeof updates.require_cid === 'boolean'
          ? updates.require_cid
          : (currentFlags as { require_cid?: boolean } | null)?.require_cid === true
      const photo =
        typeof updates.require_identity_photo === 'boolean'
          ? updates.require_identity_photo
          : (currentFlags as { require_identity_photo?: boolean } | null)?.require_identity_photo === true
      updates.require_cid = cid
      updates.require_identity_photo = photo
      updates.require_identity_documents = cid || photo
    }
  }

  if (nextStart !== undefined || nextEnd !== undefined) {
    const { data: current } = await service
      .from('platform_settings')
      .select('hero_video_start_seconds, hero_video_end_seconds')
      .eq('id', 'default')
      .maybeSingle()
    const start =
      nextStart !== undefined
        ? nextStart
        : typeof current?.hero_video_start_seconds === 'number'
          ? current.hero_video_start_seconds
          : null
    const end =
      nextEnd !== undefined
        ? nextEnd
        : typeof current?.hero_video_end_seconds === 'number'
          ? current.hero_video_end_seconds
          : null
    if (start != null && end != null && end <= start) {
      return NextResponse.json(
        { error: 'Loop end must be greater than loop start' },
        { status: 400 }
      )
    }
  }

  const { data: existing } = await service
    .from('platform_settings')
    .select('id')
    .eq('id', 'default')
    .maybeSingle()

  if (!existing) {
    const seed = {
      ...DEFAULT_PLATFORM_SETTINGS,
      landing_features: [],
      landing_steps: [],
      landing_faq: [],
      landing_section_titles: {},
      ...updates,
      id: 'default',
    }
    const { data, error } = await service
      .from('platform_settings')
      .insert(seed)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    bustPublicSiteCache()
    return NextResponse.json({ settings: parsePlatformSettings(data as Record<string, unknown>) })
  }

  const { data, error } = await service
    .from('platform_settings')
    .update(updates)
    .eq('id', 'default')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  bustPublicSiteCache()
  return NextResponse.json({
    settings: parsePlatformSettings(data as Record<string, unknown>) as PlatformSettings,
  })
}
