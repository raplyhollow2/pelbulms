import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { getApprovalScope, resolveEffectiveRole } from '@/lib/approvals-access'
import {
  computeAdminOpsReports,
  computeApprovalsReports,
  computePlatformCommandReports,
} from '@/lib/reports/compute-admin'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type { ReportSectionPayload } from '@/lib/reports/types'
import type { UserRole as AppRole } from '@/lib/roles'

/** GET /api/reports/admin — Institution ops + approvals (+ platform for superadmin) */
export async function GET(_request: NextRequest) {
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

    const role = resolveEffectiveRole((profile as any).role, user) as AppRole
    const allowed =
      role === 'admin' ||
      role === 'superadmin' ||
      role === 'resource_person'

    // Assigned reviewers may see approvals health only
    const scope = await getApprovalScope(
      service,
      user.id,
      role,
      (profile as any).institution_id
    )

    if (!allowed && !scope.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sections: ReportSectionPayload[] = []

    if (scope.allowed) {
      const institutionIds =
        scope.isSuper || scope.isSuperadmin ? null : scope.institutionIds
      const blocks = await computeApprovalsReports(service as any, {
        institutionIds: institutionIds && institutionIds.length ? institutionIds : null,
      })
      sections.push({
        section: 'approvals-health',
        title: REPORT_SECTIONS['approvals-health'].title,
        description: REPORT_SECTIONS['approvals-health'].description,
        blocks,
      })
    }

    if (role === 'admin' || role === 'superadmin') {
      const ops = await computeAdminOpsReports(service as any)
      sections.push({
        section: 'institution-ops',
        title: REPORT_SECTIONS['institution-ops'].title,
        description: REPORT_SECTIONS['institution-ops'].description,
        blocks: ops,
      })
    }

    if (role === 'superadmin') {
      const platform = await computePlatformCommandReports(service as any)
      sections.push({
        section: 'platform-command',
        title: REPORT_SECTIONS['platform-command'].title,
        description: REPORT_SECTIONS['platform-command'].description,
        blocks: platform,
      })
    }

    return NextResponse.json({
      role,
      sections,
    })
  } catch (error: any) {
    console.error('[reports/admin]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load admin reports' },
      { status: 500 }
    )
  }
}
