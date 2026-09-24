import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { resolveSnapshotForUser, roleToSnapshotAudience } from '@/lib/reports/resolve-snapshot'
import type { ReportRange, SnapshotAudience } from '@/lib/reports/types'

function parseRange(raw: string | null): ReportRange {
  if (raw === '7d' || raw === '90d' || raw === '30d') return raw
  return '30d'
}

function parsePrefer(raw: string | null): SnapshotAudience | undefined {
  if (
    raw === 'superadmin' ||
    raw === 'admin' ||
    raw === 'instructor' ||
    raw === 'resource_person' ||
    raw === 'student'
  ) {
    return raw
  }
  return undefined
}

/** GET /api/reports/snapshot?range=30d&audience=instructor */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const role = resolveEffectiveRole((profile as any).role, user)
    if (!roleToSnapshotAudience(role) && role !== 'instructor') {
      // all platform roles map; still allow any authenticated
    }

    const range = parseRange(request.nextUrl.searchParams.get('range'))
    const prefer = parsePrefer(request.nextUrl.searchParams.get('audience'))
    const instructorId = request.nextUrl.searchParams.get('instructorId')

    const snapshot = await resolveSnapshotForUser(service as any, {
      userId: user.id,
      role,
      range,
      prefer,
      institutionId: (profile as any).institution_id,
      instructorId: role === 'superadmin' ? instructorId : null,
    })

    return NextResponse.json(
      { snapshot },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (error: any) {
    console.error('[reports/snapshot]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to build snapshot' },
      { status: 500 }
    )
  }
}
