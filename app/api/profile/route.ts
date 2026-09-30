import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { parseSocialLinks } from '@/lib/social-links'
import { applyProfileDetails, syncRegistrationFromProfile } from '@/lib/profile-fields'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/profile - Fetch user profile
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(profile)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await createSupabaseServerClient()
    const sessionUser = await getRequestUser(request)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { data: existing } = await session
      .from('profiles')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim()
    if (typeof body.bio === 'string' || body.bio === null) updates.bio = body.bio
    if (typeof body.avatar_url === 'string' || body.avatar_url === null) updates.avatar_url = body.avatar_url
    if (body.social_links !== undefined) {
      const normalizedSocial = parseSocialLinks(body.social_links)
      if (normalizedSocial) updates.social_links = normalizedSocial
    }

    const detailError = applyProfileDetails(body, updates)
    if (detailError) {
      return NextResponse.json({ error: detailError }, { status: 400 })
    }

    const existingRow = existing as unknown as { metadata?: unknown } | null
    const existingMeta =
      existingRow?.metadata && typeof existingRow.metadata === 'object'
        ? (existingRow.metadata as Record<string, unknown>)
        : {}
    updates.metadata = {
      ...existingMeta,
      phone_number: updates.phone_number !== undefined ? updates.phone_number : existingMeta.phone_number,
      cid_number: updates.cid_number !== undefined ? updates.cid_number : existingMeta.cid_number,
      pelsung_number:
        updates.pelsung_number !== undefined ? updates.pelsung_number : existingMeta.pelsung_number,
      class: updates.class_name !== undefined ? updates.class_name : existingMeta.class,
    }

    const { data: profile, error } = await session
      .from('profiles')
      .update(updates as never)
      .eq('id', sessionUser.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const syncError = await syncRegistrationFromProfile(session, sessionUser.id, updates)
    if (syncError) {
      return NextResponse.json({ error: syncError }, { status: 400 })
    }

    if (updates.full_name !== undefined) {
      const service = await tryCreateServiceClient()
      if (service) {
        await service.auth.admin.updateUserById(sessionUser.id, {
          user_metadata: { full_name: updates.full_name },
        })
      }
    }

    return NextResponse.json(profile)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}