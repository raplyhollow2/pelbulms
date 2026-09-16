// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/institutions
 * Active institutions for catalog filters and course audience targeting.
 * Requires authentication.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = (await tryCreateServiceClient()) || supabase

  let { data: institutions, error } = await service
    .from('institutions')
    .select('id, name, slug, display_name, logo_url, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error && /is_active/.test(error.message || '')) {
    const fallback = await service
      .from('institutions')
      .select('id, name, slug, display_name, logo_url')
      .order('name', { ascending: true })
    institutions = (fallback.data || []).map((i: any) => ({ ...i, is_active: true }))
    error = fallback.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ institutions: institutions || [] })
}
