// @ts-nocheck - platform_settings not in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC, checkCapability, CAP } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { getAdminDb } from '@/lib/supabase/server'
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
  type PlatformSettings,
} from '@/lib/platform-settings'
import {
  normalizeLandingFaqInput,
  normalizeLandingFeaturesInput,
  normalizeLandingSectionTitlesInput,
  normalizeLandingStatsInput,
  normalizeLandingStepsInput,
  parseHeroRotatingWords,
} from '@/lib/landing-content'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

async function requireSettings(request: NextRequest, write: boolean) {
  const cap = await checkCapability(
    request,
    write ? CAP.SETTINGS_EDIT : CAP.SETTINGS_VIEW
  )
  if (cap.hasAccess) return cap
  return checkRBAC(request, ADMIN_ROLES)
}

const BOOLEAN_KEYS = [
  'public_catalog',
  'maintenance_mode',
  'require_identity_documents',
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
  const rbac = await requireSettings(request, false)
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
  const rbac = await requireSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

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

  const service = await getAdminDb()

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
    return NextResponse.json({ settings: parsePlatformSettings(data as Record<string, unknown>) })
  }

  const { data, error } = await service
    .from('platform_settings')
    .update(updates)
    .eq('id', 'default')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    settings: parsePlatformSettings(data as Record<string, unknown>) as PlatformSettings,
  })
}
