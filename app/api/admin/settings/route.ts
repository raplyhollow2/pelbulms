// @ts-nocheck - platform_settings not in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { getAdminDb } from '@/lib/supabase/server'
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
  type PlatformSettings,
} from '@/lib/platform-settings'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
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
] as const

/**
 * GET /api/admin/settings
 * Admin or superadmin. Returns platform settings plus courses for featured picking.
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ADMIN_ROLES)
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
  const rbac = await checkRBAC(request, ADMIN_ROLES)
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

  const service = await getAdminDb()

  const { data: existing } = await service
    .from('platform_settings')
    .select('id')
    .eq('id', 'default')
    .maybeSingle()

  if (!existing) {
    const seed = { ...DEFAULT_PLATFORM_SETTINGS, ...updates, id: 'default' }
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
