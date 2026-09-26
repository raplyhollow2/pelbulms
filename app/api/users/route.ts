// @ts-nocheck - roles join / role_id not yet in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import {
  CAP,
  enforceCapability,
  filterByInstitutionScope,
  institutionAllowed,
} from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/roles'
import { normalizeDzongkhag } from '@/lib/dzongkhags'
import { PHONE_RE } from '@/lib/profile-fields'

type Role = UserRole

const VALID_ROLES: Role[] = ['student', 'instructor', 'admin', 'resource_person', 'superadmin']

async function requireUsersCap(
  request: NextRequest,
  caps: string[],
  fallbackRoles: Role[] = ['admin', 'superadmin']
) {
  return enforceCapability(request, caps, fallbackRoles)
}

/**
 * GET /api/users
 * List user profiles. Requires admin.users.view (or admin/superadmin fallback).
 */
export async function GET(request: NextRequest) {
  const rbac = await requireUsersCap(request, [CAP.USERS_VIEW])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*, roles:role_id(id, slug, name, base_archetype)')
      .order('created_at', { ascending: false })

    if (error) {
      // role_id / roles join may fail pre-migration
      const fallback = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 400 })
      }
      const users = filterByInstitutionScope(
        (fallback.data ?? []) as { institution_id?: string | null }[],
        (rbac as any).capabilities
      )
      return NextResponse.json({ users })
    }

    const users = filterByInstitutionScope(
      (data ?? []) as { institution_id?: string | null }[],
      (rbac as any).capabilities
    )
    return NextResponse.json({ users })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user. Body may include role (archetype) and/or role_id (custom).
 */
export async function POST(request: NextRequest) {
  const rbac = await requireUsersCap(request, [CAP.USERS_ADD])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const body = await request.json()
    const {
      email,
      full_name,
      role = 'student',
      role_id = null,
      bio = null,
      avatar_url = null,
      password,
      institution_id = null,
      phone_number = null,
      location = null,
    } = body ?? {}

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    let resolvedRole: Role = role
    let resolvedRoleId: string | null = role_id

    if (role_id) {
      const { data: roleRow } = await supabase
        .from('roles')
        .select('id, base_archetype, is_assignable')
        .eq('id', role_id)
        .maybeSingle()
      if (!roleRow || !(roleRow as any).is_assignable) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      resolvedRole = (roleRow as any).base_archetype as Role
      resolvedRoleId = (roleRow as any).id
    } else if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (
      (resolvedRole === 'instructor' || resolvedRole === 'resource_person') &&
      rbac.userRole !== 'superadmin'
    ) {
      return NextResponse.json(
        { error: 'Only a superadmin can grant instructor or resource person roles' },
        { status: 403 }
      )
    }
    if (resolvedRole === 'superadmin' && rbac.userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only a superadmin can grant the superadmin role' },
        { status: 403 }
      )
    }

    if (
      institution_id &&
      !institutionAllowed(institution_id, (rbac as any).capabilities)
    ) {
      return NextResponse.json(
        { error: 'Institution outside your permission scope' },
        { status: 403 }
      )
    }

    let normalizedPhone: string | null = null
    if (typeof phone_number === 'string' && phone_number.trim()) {
      if (!PHONE_RE.test(phone_number.trim())) {
        return NextResponse.json(
          { error: 'Phone must be +975 followed by 8 digits.' },
          { status: 400 }
        )
      }
      normalizedPhone = phone_number.trim()
    }
    let normalizedPlace: string | null = null
    if (typeof location === 'string' && location.trim()) {
      const place = normalizeDzongkhag(location)
      if (!place) {
        return NextResponse.json({ error: 'Please select a valid dzongkhag.' }, { status: 400 })
      }
      normalizedPlace = place
    }

    const tempPassword = password || `Pelbu-${Math.random().toString(36).slice(-10)}!`
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: resolvedRole },
      })

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    const profilePayload: Record<string, unknown> = {
      id: created.user.id,
      email,
      full_name,
      role: resolvedRole,
      bio,
      avatar_url,
      account_status: 'active',
      updated_at: new Date().toISOString(),
    }
    if (institution_id) profilePayload.institution_id = institution_id
    if (resolvedRoleId) profilePayload.role_id = resolvedRoleId
    if (normalizedPhone) profilePayload.phone_number = normalizedPhone
    if (normalizedPlace) profilePayload.location = normalizedPlace

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload as never, { onConflict: 'id' })
      .select()
      .single()

    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ user: profile }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}
