import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/certificates
 * Lists the authenticated user's certificates (with course info).
 */
export async function GET() {
  try {
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data, error } = await service
      .from('certificates')
      .select('*, courses(title, category, thumbnail_url)')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ certificates: data ?? [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
