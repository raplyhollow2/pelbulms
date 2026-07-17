import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

type Role = 'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'

const VALID_ROLES: Role[] = ['student', 'instructor', 'admin', 'resource_person', 'superadmin']

/**
 * GET /api/users
 * List all user profiles. Admin only.
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ['admin', 'superadmin'])
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
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ users: data ?? [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user (auth account + profile). Admin only.
 * Body: { email, full_name, role, bio?, avatar_url?, password? }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['admin', 'superadmin'])
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
      bio = null,
      avatar_url = null,
      password,
    } = body ?? {}

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Create the auth user (email confirmed so they can be invited/reset later)
    const tempPassword = password || `Pelbu-${Math.random().toString(36).slice(-10)}!`
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role },
      })

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to create auth user' },
        { status: 400 }
      )
    }

    // Upsert profile (a DB trigger may have already created a base row)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: created.user.id,
          email,
          full_name,
          role,
          bio,
          avatar_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (profileError) {
      // Roll back the auth user so we don't leave an orphan account
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
