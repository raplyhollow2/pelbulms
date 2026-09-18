// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { CAP, capabilityDenied, checkCapability } from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ roleId: string }> }

/**
 * PATCH /api/admin/roles/[roleId]
 * Update role metadata and/or replace capability + institution grants.
 * Body: {
 *   name?, description?, all_institutions?,
 *   capability_ids?: string[],
 *   institution_ids?: string[]
 * }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const check = await checkCapability(request, CAP.PERMISSIONS_EDIT)
  if (!check.hasAccess && check.userRole !== 'superadmin') {
    return capabilityDenied(check)
  }

  try {
    const { roleId } = await context.params
    const body = await request.json()
    const service = await createServiceClient()

    const { data: existing, error: findError } = await service
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.name === 'string' && body.name.trim()) {
      // System roles keep slug; name can still be display-renamed for custom only
      if (!(existing as any).is_system) {
        updates.name = body.name.trim()
      } else if (body.name.trim()) {
        updates.name = body.name.trim()
      }
    }
    if (typeof body.description === 'string' || body.description === null) {
      updates.description = body.description
    }
    if (typeof body.all_institutions === 'boolean') {
      updates.all_institutions = body.all_institutions
    }
    if (typeof body.is_assignable === 'boolean' && !(existing as any).is_system) {
      updates.is_assignable = body.is_assignable
    }

    if (Object.keys(updates).length > 1) {
      const { error: updError } = await service
        .from('roles')
        .update(updates)
        .eq('id', roleId)
      if (updError) {
        return NextResponse.json({ error: updError.message }, { status: 400 })
      }
    }

    if (Array.isArray(body.capability_ids)) {
      const ids = body.capability_ids.filter((id: unknown) => typeof id === 'string') as string[]
      await service.from('role_capabilities').delete().eq('role_id', roleId)
      if (ids.length) {
        const { error: grantError } = await service.from('role_capabilities').insert(
          ids.map((capability_id) => ({ role_id: roleId, capability_id }))
        )
        if (grantError) {
          return NextResponse.json({ error: grantError.message }, { status: 400 })
        }
      }
    }

    if (Array.isArray(body.institution_ids)) {
      const ids = body.institution_ids.filter((id: unknown) => typeof id === 'string') as string[]
      await service.from('role_institutions').delete().eq('role_id', roleId)
      if (ids.length && body.all_institutions !== true) {
        const { error: instError } = await service.from('role_institutions').insert(
          ids.map((institution_id) => ({ role_id: roleId, institution_id }))
        )
        if (instError) {
          return NextResponse.json({ error: instError.message }, { status: 400 })
        }
      }
    }

    const { data: role } = await service.from('roles').select('*').eq('id', roleId).single()
    const { data: grants } = await service
      .from('role_capabilities')
      .select('capability_id')
      .eq('role_id', roleId)
    const { data: institutions } = await service
      .from('role_institutions')
      .select('institution_id')
      .eq('role_id', roleId)

    return NextResponse.json({
      role,
      capability_ids: (grants || []).map((g: any) => g.capability_id),
      institution_ids: (institutions || []).map((g: any) => g.institution_id),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update role' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/roles/[roleId]
 * Delete a custom role only. Reassign users to the base archetype system role.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const check = await checkCapability(request, CAP.PERMISSIONS_EDIT)
  if (!check.hasAccess && check.userRole !== 'superadmin') {
    return capabilityDenied(check)
  }

  try {
    const { roleId } = await context.params
    const service = await createServiceClient()

    const { data: existing } = await service
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    if ((existing as any).is_system) {
      return NextResponse.json(
        { error: 'System roles cannot be deleted' },
        { status: 400 }
      )
    }

    const base = (existing as any).base_archetype as string
    const { data: fallback } = await service
      .from('roles')
      .select('id')
      .eq('slug', base)
      .eq('is_system', true)
      .maybeSingle()

    if (fallback) {
      await service
        .from('profiles')
        .update({ role_id: (fallback as any).id, role: base })
        .eq('role_id', roleId)
    }

    const { error } = await service.from('roles').delete().eq('id', roleId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete role' },
      { status: 500 }
    )
  }
}
