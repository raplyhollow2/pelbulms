// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { getAdminDb } from '@/lib/supabase/server'
import { uniqueInstitutionSlug } from '@/lib/institution-slug'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

function parseDomains(value: unknown): string[] | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const list = value.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
    return list.length ? list : null
  }
  if (typeof value === 'string') {
    const list = value
      .split(/[,;\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
    return list.length ? list : null
  }
  return null
}

/**
 * GET /api/admin/institutions
 * Admin or superadmin. Includes archived rows when ?archived=1 (superadmin UI).
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ADMIN_ROLES)
  if (!rbac.hasAccess) return denied(rbac)

  const service = await getAdminDb()
  const includeArchived = new URL(request.url).searchParams.get('archived') === '1'

  let query = service
    .from('institutions')
    .select(
      'id, name, slug, display_name, logo_url, domain, description, max_students, allowed_email_domains, is_active, archived_at, created_at, updated_at'
    )
    .order('name', { ascending: true })

  if (!includeArchived) {
    query = query.eq('is_active', true)
  }

  let { data: institutions, error } = await query
  if (error && /is_active|archived_at/.test(error.message || '')) {
    const fallback = await service
      .from('institutions')
      .select('id, name, slug, display_name, logo_url, domain, description, max_students, allowed_email_domains, created_at, updated_at')
      .order('name', { ascending: true })
    institutions = (fallback.data || []).map((i: any) => ({ ...i, is_active: true, archived_at: null }))
    error = fallback.error
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const ids = (institutions || []).map((i: { id: string }) => i.id)
  const counts = new Map<string, number>()
  if (ids.length) {
    const { data: profiles } = await service
      .from('profiles')
      .select('institution_id')
      .in('institution_id', ids)
    for (const row of profiles || []) {
      const id = (row as { institution_id?: string }).institution_id
      if (!id) continue
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }

  return NextResponse.json({
    institutions: (institutions || []).map((i: any) => ({
      ...i,
      user_count: counts.get(i.id) || 0,
    })),
  })
}

/**
 * POST /api/admin/institutions
 * Admin or superadmin. Create Dessung, Pelsung, or any other institute.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ADMIN_ROLES)
  if (!rbac.hasAccess) return denied(rbac)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const service = await getAdminDb()
  const slug = await uniqueInstitutionSlug(
    service,
    typeof body.slug === 'string' && body.slug.trim() ? body.slug : name
  )
  const displayName =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim()
      : name

  const maxStudents =
    body.max_students === null || body.max_students === '' || body.max_students === undefined
      ? null
      : Number(body.max_students)
  if (maxStudents != null && (!Number.isFinite(maxStudents) || maxStudents < 1)) {
    return NextResponse.json({ error: 'max_students must be a positive number' }, { status: 400 })
  }

  const { data, error } = await service
    .from('institutions')
    .insert({
      name,
      slug,
      display_name: displayName,
      logo_url: typeof body.logo_url === 'string' && body.logo_url.trim() ? body.logo_url.trim() : null,
      domain: typeof body.domain === 'string' && body.domain.trim() ? body.domain.trim() : null,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
      max_students: maxStudents,
      allowed_email_domains: parseDomains(body.allowed_email_domains),
      is_active: body.is_active === false ? false : true,
      archived_at: body.is_active === false ? new Date().toISOString() : null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ institution: { ...data, user_count: 0 } }, { status: 201 })
}
