// @ts-nocheck - roles / role_id not yet in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import {
  CAP,
  enforceCapability,
  institutionAllowed,
} from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/roles'
import { normalizeDzongkhag } from '@/lib/dzongkhags'
import { CID_RE, PHONE_RE } from '@/lib/profile-fields'

type Role = UserRole

const VALID_ROLES: Role[] = ['student', 'instructor', 'admin', 'resource_person', 'superadmin']
const GENDERS = new Set(['male', 'female', 'other'])

const PROFILE_TEXT_FIELDS = [
  'gewog',
  'village',
  'education_level',
  'passport_photo_url',
  'cid_photo_url',
  'pelsung_number',
  'class_name',
  'emergency_contact_name',
  'emergency_contact_phone',
  'parent_guardian_name',
  'parent_guardian_phone',
  'headline',
  'website',
] as const

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || null
}

function applyProfileDetails(body: Record<string, unknown>, updates: Record<string, unknown>) {
  const phone = optionalText(body.phone_number)
  if (body.phone_number !== undefined) {
    if (phone === undefined) return 'Invalid phone number'
    if (phone && !PHONE_RE.test(phone)) return 'Phone must be +975 followed by 8 digits.'
    updates.phone_number = phone
  }

  const cid = optionalText(body.cid_number)
  if (body.cid_number !== undefined) {
    if (cid === undefined) return 'Invalid CID number'
    if (cid && !CID_RE.test(cid)) return 'CID number must be exactly 11 digits.'
    updates.cid_number = cid
  }

  if (body.location !== undefined) {
    const place = optionalText(body.location)
    if (place === undefined) return 'Invalid dzongkhag'
    if (place && !normalizeDzongkhag(place)) return 'Please select a valid dzongkhag.'
    updates.location = place ? normalizeDzongkhag(place) : null
  }

  if (body.gender !== undefined) {
    const gender = optionalText(body.gender)
    if (gender === undefined) return 'Invalid gender'
    if (gender && !GENDERS.has(gender)) return 'Invalid gender'
    updates.gender = gender
  }

  if (body.date_of_birth !== undefined) {
    const dob = optionalText(body.date_of_birth)
    if (dob === undefined) return 'Invalid date of birth'
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Date of birth must be YYYY-MM-DD.'
    updates.date_of_birth = dob
  }

  for (const key of PROFILE_TEXT_FIELDS) {
    if (body[key] === undefined) continue
    const value = optionalText(body[key])
    if (value === undefined) return `Invalid ${key.replaceAll('_', ' ')}`
    updates[key] = value
  }

  return null
}

async function syncRegistrationFromProfile(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  updates: Record<string, unknown>
) {
  const reg: Record<string, unknown> = { updated_at: updates.updated_at }
  const copy = (from: string, to = from, allowNull = true) => {
    if (updates[from] === undefined) return
    if (updates[from] === null && !allowNull) return
    reg[to] = updates[from]
  }
  copy('full_name', 'full_name', false)
  copy('email', 'email', false)
  copy('phone_number', 'phone_number', false)
  copy('date_of_birth')
  copy('gender')
  copy('cid_number')
  copy('gewog')
  copy('village')
  copy('education_level')
  copy('passport_photo_url')
  copy('cid_photo_url')
  copy('pelsung_number')
  copy('emergency_contact_name')
  copy('emergency_contact_phone')
  copy('parent_guardian_name')
  copy('parent_guardian_phone')
  if (updates.location !== undefined) reg.dzongkhag = updates.location
  if (updates.class_name !== undefined) reg.class = updates.class_name
  if (Object.keys(reg).length <= 1) return null
  const { error } = await supabase.from('student_registrations').update(reg as never).eq('user_id', userId)
  if (error) return error.message || 'Could not sync registration details.'
  return null
}

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

async function requireUsersCap(request: NextRequest, caps: string[]) {
  return enforceCapability(request, caps, ['admin', 'superadmin'])
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await requireUsersCap(request, [CAP.USERS_VIEW])
  if (!rbac.hasAccess) return denied(rbac)

  try {
    const { userId } = await params
    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (
      !institutionAllowed(
        (data as any)?.institution_id,
        (rbac as any).capabilities
      )
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ user: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await requireUsersCap(request, [CAP.USERS_EDIT])
  if (!rbac.hasAccess) return denied(rbac)

  try {
    const { userId } = await params
    const body = await request.json()
    const supabase = await createServiceClient()

    const { data: target } = await supabase
      .from('profiles')
      .select('role, institution_id, email, metadata')
      .eq('id', userId)
      .single()
    const targetRole = (target as { role?: string } | null)?.role

    if (
      !institutionAllowed(
        (target as any)?.institution_id,
        (rbac as any).capabilities
      )
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (rbac.userRole !== 'superadmin') {
      if (targetRole === 'superadmin') {
        return NextResponse.json(
          { error: 'Only a superadmin can modify a superadmin account' },
          { status: 403 }
        )
      }
      if (body.role === 'superadmin') {
        return NextResponse.json(
          { error: 'Only a superadmin can grant the superadmin role' },
          { status: 403 }
        )
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.full_name === 'string') updates.full_name = body.full_name
    if (typeof body.bio === 'string' || body.bio === null) updates.bio = body.bio

    if (typeof body.email === 'string') {
      const email = body.email.trim().toLowerCase()
      const currentEmail = String((target as { email?: string } | null)?.email || '').toLowerCase()
      if (email !== currentEmail) {
        if (rbac.userRole !== 'superadmin') {
          return NextResponse.json(
            { error: 'Only a superadmin can change an email address' },
            { status: 403 }
          )
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
        }
        const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        })
        if (emailError) {
          return NextResponse.json({ error: emailError.message }, { status: 400 })
        }
        updates.email = email
      }
    }

    const detailError = applyProfileDetails(body, updates)
    if (detailError) {
      return NextResponse.json({ error: detailError }, { status: 400 })
    }
    if (typeof body.avatar_url === 'string' || body.avatar_url === null)
      updates.avatar_url = body.avatar_url
    if (body.institution_id !== undefined) {
      if (body.institution_id === null || body.institution_id === '') {
        updates.institution_id = null
      } else if (typeof body.institution_id === 'string') {
        if (!institutionAllowed(body.institution_id, (rbac as any).capabilities)) {
          return NextResponse.json(
            { error: 'Institution outside your permission scope' },
            { status: 403 }
          )
        }
        updates.institution_id = body.institution_id
      } else {
        return NextResponse.json({ error: 'Invalid institution' }, { status: 400 })
      }
    }
    if (body.account_status !== undefined) {
      const statuses = ['pending', 'active', 'suspended', 'rejected'] as const
      if (
        typeof body.account_status !== 'string' ||
        !statuses.includes(body.account_status as (typeof statuses)[number])
      ) {
        return NextResponse.json({ error: 'Invalid account status' }, { status: 400 })
      }
      if (body.account_status === 'suspended' && userId === rbac.userId) {
        return NextResponse.json({ error: 'You cannot suspend your own account' }, { status: 400 })
      }
      updates.account_status = body.account_status
    }

    if (body.role_id !== undefined && body.role_id) {
      const { data: roleRow } = await supabase
        .from('roles')
        .select('id, base_archetype, is_assignable')
        .eq('id', body.role_id)
        .maybeSingle()
      if (!roleRow || !(roleRow as any).is_assignable) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const arche = (roleRow as any).base_archetype as Role
      if (
        (arche === 'instructor' || arche === 'resource_person') &&
        rbac.userRole !== 'superadmin'
      ) {
        return NextResponse.json(
          { error: 'Only a superadmin can grant instructor or resource person roles' },
          { status: 403 }
        )
      }
      if (arche === 'superadmin' && rbac.userRole !== 'superadmin') {
        return NextResponse.json(
          { error: 'Only a superadmin can grant the superadmin role' },
          { status: 403 }
        )
      }
      updates.role_id = (roleRow as any).id
      updates.role = arche
    } else if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      if (
        (body.role === 'instructor' || body.role === 'resource_person') &&
        rbac.userRole !== 'superadmin'
      ) {
        return NextResponse.json(
          { error: 'Only a superadmin can grant instructor or resource person roles' },
          { status: 403 }
        )
      }
      updates.role = body.role
    }

    const existingMeta =
      (target as { metadata?: Record<string, unknown> } | null)?.metadata &&
      typeof (target as { metadata?: unknown }).metadata === 'object'
        ? ((target as { metadata: Record<string, unknown> }).metadata)
        : {}
    updates.metadata = {
      ...existingMeta,
      phone_number: updates.phone_number !== undefined ? updates.phone_number : existingMeta.phone_number,
      cid_number: updates.cid_number !== undefined ? updates.cid_number : existingMeta.cid_number,
      pelsung_number:
        updates.pelsung_number !== undefined ? updates.pelsung_number : existingMeta.pelsung_number,
      class: updates.class_name !== undefined ? updates.class_name : existingMeta.class,
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const syncError = await syncRegistrationFromProfile(supabase, userId, updates)
    if (syncError) {
      return NextResponse.json({ error: syncError }, { status: 400 })
    }

    const metadata: Record<string, unknown> = {}
    if (updates.full_name !== undefined) metadata.full_name = updates.full_name
    if (updates.role !== undefined) metadata.role = updates.role
    if (Object.keys(metadata).length > 0) {
      await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata })
    }

    if (
      updates.account_status !== undefined ||
      updates.role !== undefined ||
      updates.institution_id !== undefined
    ) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      const current = (authUser?.user?.app_metadata as Record<string, unknown>) || {}
      const appPatch: Record<string, unknown> = { ...current }
      if (updates.account_status !== undefined) appPatch.account_status = updates.account_status
      if (updates.role !== undefined) appPatch.role = updates.role
      if (updates.institution_id !== undefined) {
        appPatch.institution_id = updates.institution_id ? String(updates.institution_id) : null
      }
      await supabase.auth.admin.updateUserById(userId, { app_metadata: appPatch })
    }

    return NextResponse.json({ user: profile })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await requireUsersCap(request, [CAP.USERS_DELETE])
  if (!rbac.hasAccess) return denied(rbac)

  try {
    const { userId } = await params

    if (userId === rbac.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    const { data: target } = await supabase
      .from('profiles')
      .select('role, institution_id')
      .eq('id', userId)
      .single()
    if (
      (target as { role?: string } | null)?.role === 'superadmin' &&
      rbac.userRole !== 'superadmin'
    ) {
      return NextResponse.json(
        { error: 'Only a superadmin can delete a superadmin account' },
        { status: 403 }
      )
    }
    if (
      !institutionAllowed(
        (target as any)?.institution_id,
        (rbac as any).capabilities
      )
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError && !/not.*found/i.test(authError.message)) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
