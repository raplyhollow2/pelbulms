import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    let reason = 'unload'
    try {
      const body = await request.json()
      if (typeof body?.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 40)
      }
    } catch {
      /* empty body is fine */
    }

    await (supabase as any).rpc('presence_leave', { p_reason: reason })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[presence/leave]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
