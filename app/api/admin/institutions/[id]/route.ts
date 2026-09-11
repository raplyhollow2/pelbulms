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
 * PATCH /api/admin/institutions/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await checkRBAC(request, ADMIN_ROLES)
  if (!rbac.hasAccess) return denied(rbac)

  const { id } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const service = await getAdminDb()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    updates.name = name
  }
  if (typeof body.display_name === 'string' || body.display_name === null) {
    updates.display_name = typeof body.display_name === 'string' ? body.display_name.trim() || null : null
  }
  if (typeof body.slug === 'string' && body.slug.trim()) {
    updates.slug = await uniqueInstitutionSlug(service, body.slug, id)
  }
  if (typeof body.logo_url === 'string' || body.logo_url === null) {
    updates.logo_url = typeof body.logo_url === 'string' ? body.logo_url.trim() || null : null
  }
  if (typeof body.domain === 'string' || body.domain === null) {
    updates.domain = typeof body.domain === 'string' ? body.domain.trim() || null : null
  }
  if (typeof body.description === 'string' || body.description === null) {
    updates.description = typeof body.description === 'string' ? body.description.trim() || null : null
  }
  if (body.max_students !== undefined) {
    if (body.max_students === null || body.max_students === '') {
      updates.max_students = null
    } else {
      const n = Number(body.max_students)
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: 'max_students must be a positive number' }, { status: 400 })
      }
      updates.max_students = n
    }
  }
  if (body.allowed_email_domains !== undefined) {
    updates.allowed_email_domains = parseDomains(body.allowed_email_domains)
  }
  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active
    updates.archived_at = body.is_active ? null : new Date().toISOString()
  }

  const { data, error } = await service
    .from('institutions')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ institution: data })
}

/**
 * DELETE /api/admin/institutions/[id]
 * Soft-delete (archive). Hard delete would cascade student registrations.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await checkRBAC(request, ADMIN_ROLES)
  if (!rbac.hasAccess) return denied(rbac)

  const { id } = await params
  const service = await getAdminDb()

  const { data, error } = await service
    .from('institutions')
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, name, is_active, archived_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ institution: data, archived: true })
}
