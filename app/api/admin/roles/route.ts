// @ts-nocheck - roles/capabilities tables not yet in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import {
  CAP,
  capabilityDenied,
  checkCapability,
  listCapabilities,
  listRoles,
  slugifyRoleName,
  type CapabilityRow,
  type RoleRow,
} from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/roles'

const ARCHETYPES: UserRole[] = [
  'student',
  'instructor',
  'admin',
  'resource_person',
  'superadmin',
]

/**
 * GET /api/admin/roles
 * Superadmin: list roles, capabilities, grants, institutions for the matrix UI.
 */
export async function GET(request: NextRequest) {
  const check = await checkCapability(request, CAP.PERMISSIONS_VIEW)
  if (!check.hasAccess) {
    // Only superadmin should edit; also allow if they have the capability seed
    if (check.userRole !== 'superadmin') return capabilityDenied(check)
  }

  try {
    const service = await createServiceClient()
    const [roles, capabilities] = await Promise.all([
      listRoles(service as any),
      listCapabilities(service as any),
    ])

    const { data: grants } = await service
      .from('role_capabilities')
      .select('role_id, capability_id')

    const { data: roleInstitutions } = await service
      .from('role_institutions')
      .select('role_id, institution_id')

    let { data: institutions, error: instError } = await service
      .from('institutions')
      .select('id, name, display_name, is_active')
      .order('name')
    if (instError && /is_active|display_name/.test(instError.message || '')) {
      const fallback = await service.from('institutions').select('id, name').order('name')
      institutions = (fallback.data || []).map((i: any) => ({
        ...i,
        display_name: i.name,
        is_active: true,
      }))
    }

    const grantsByRole: Record<string, string[]> = {}
    for (const g of grants || []) {
      const rid = (g as any).role_id as string
      const cid = (g as any).capability_id as string
      if (!grantsByRole[rid]) grantsByRole[rid] = []
      grantsByRole[rid].push(cid)
    }

    const institutionsByRole: Record<string, string[]> = {}
    for (const row of roleInstitutions || []) {
      const rid = (row as any).role_id as string
      const iid = (row as any).institution_id as string
      if (!institutionsByRole[rid]) institutionsByRole[rid] = []
      institutionsByRole[rid].push(iid)
    }

    return NextResponse.json({
      roles: roles as RoleRow[],
      capabilities: capabilities as CapabilityRow[],
      grantsByRole,
      institutionsByRole,
      institutions: institutions || [],
      archetypes: ARCHETYPES,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load roles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/roles
 * Create a custom role by cloning an archetype (and its grants).
 * Body: { name, description?, base_archetype, clone_from_role_id? }
 */
export async function POST(request: NextRequest) {
  const check = await checkCapability(request, CAP.PERMISSIONS_EDIT)
  if (!check.hasAccess && check.userRole !== 'superadmin') {
    return capabilityDenied(check)
  }

  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const description =
      typeof body?.description === 'string' ? body.description.trim() : null
    const base = body?.base_archetype as UserRole
    const cloneFrom = body?.clone_from_role_id as string | undefined

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!ARCHETYPES.includes(base)) {
      return NextResponse.json({ error: 'Invalid base_archetype' }, { status: 400 })
    }

    const service = await createServiceClient()
    let slug = slugifyRoleName(name)
    const { data: existing } = await service
      .from('roles')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()
    if (existing) slug = `${slug}-${Date.now().toString(36)}`

    const { data: sourceRole } = cloneFrom
      ? await service.from('roles').select('*').eq('id', cloneFrom).maybeSingle()
      : await service
          .from('roles')
          .select('*')
          .eq('slug', base)
          .eq('is_system', true)
          .maybeSingle()

    const { data: role, error } = await service
      .from('roles')
      .insert({
        slug,
        name,
        description,
        is_system: false,
        base_archetype: base,
        is_assignable: true,
        all_institutions: (sourceRole as any)?.all_institutions ?? true,
        sort_order: 200,
      })
      .select()
      .single()

    if (error || !role) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create role' },
        { status: 400 }
      )
    }

    if (sourceRole) {
      const { data: sourceGrants } = await service
        .from('role_capabilities')
        .select('capability_id')
        .eq('role_id', (sourceRole as any).id)

      if (sourceGrants?.length) {
        await service.from('role_capabilities').insert(
          sourceGrants.map((g: any) => ({
            role_id: (role as any).id,
            capability_id: g.capability_id,
          }))
        )
      }

      const { data: sourceInst } = await service
        .from('role_institutions')
        .select('institution_id')
        .eq('role_id', (sourceRole as any).id)

      if (sourceInst?.length) {
        await service.from('role_institutions').insert(
          sourceInst.map((g: any) => ({
            role_id: (role as any).id,
            institution_id: g.institution_id,
          }))
        )
      }
    }

    return NextResponse.json({ role }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create role' },
      { status: 500 }
    )
  }
}
