import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

type Role = 'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'

const VALID_ROLES: Role[] = ['student', 'instructor', 'admin', 'resource_person', 'superadmin']

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

/**
 * GET /api/users/[userId]
 * Fetch a single profile. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await checkRBAC(request, ['admin', 'superadmin'])
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

    return NextResponse.json({ user: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/[userId]
 * Update profile fields (full_name, bio, avatar_url, role). Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await checkRBAC(request, ['admin', 'superadmin'])
  if (!rbac.hasAccess) return denied(rbac)

  try {
    const { userId } = await params
    const body = await request.json()

    const supabase = await createServiceClient()

    // Guard the superadmin tier: only a superadmin may touch a superadmin
    // account or grant/revoke the superadmin role.
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    const targetRole = (target as { role?: string } | null)?.role

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
    if (typeof body.avatar_url === 'string' || body.avatar_url === null)
      updates.avatar_url = body.avatar_url
    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updates.role = body.role
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Keep auth user_metadata in sync for name/role
    const metadata: Record<string, unknown> = {}
    if (updates.full_name !== undefined) metadata.full_name = updates.full_name
    if (updates.role !== undefined) metadata.role = updates.role
    if (Object.keys(metadata).length > 0) {
      await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata })
    }

    return NextResponse.json({ user: profile })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[userId]
 * Remove the profile and auth account. Admin only. Cannot delete self.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await checkRBAC(request, ['admin', 'superadmin'])
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

    // Only a superadmin can delete another superadmin.
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
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

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Remove the auth account (ignore "not found" style errors)
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
