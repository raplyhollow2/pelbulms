import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { listReportScopeOptions, type ReportScopeAudience } from '@/lib/reports/scope'
import { getRequestUser } from '@/lib/request-user'

function parseAudience(raw: string | null): ReportScopeAudience | null {
  if (
    raw === 'superadmin' ||
    raw === 'admin' ||
    raw === 'instructor' ||
    raw === 'resource_person' ||
    raw === 'student'
  ) {
    return raw
  }
  return null
}

/** GET /api/reports/scope-options — institutions & courses the viewer may filter to. */
export async function GET(request: NextRequest) {
  try {
    await createSupabaseServerClient()
    const user = await getRequestUser(request)
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
    if (role === 'student') {
      return NextResponse.json({ institutions: [], courses: [], defaultInstitutionIds: [] })
    }

    const audience = parseAudience(request.nextUrl.searchParams.get('audience'))
    const options = await listReportScopeOptions(
      service as any,
      user.id,
      role,
      (profile as any).institution_id,
      audience
    )

    return NextResponse.json(options, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (error: any) {
    console.error('[reports/scope-options]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load scope options' },
      { status: 500 }
    )
  }
}
