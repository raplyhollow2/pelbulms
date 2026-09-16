import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { computeTeachReports } from '@/lib/reports/compute-teach'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type { ReportSectionPayload } from '@/lib/reports/types'

/** GET /api/reports/teach — Course Insights for instructors / teaching roles */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [
    'instructor',
    'admin',
    'resource_person',
    'superadmin',
  ])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json(
      { error: rbac.error || 'Unauthorized' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const db = await getDbClient()
    const { blocks } = await computeTeachReports(db as any, rbac.userId)
    const section: ReportSectionPayload = {
      section: 'course-insights',
      title: REPORT_SECTIONS['course-insights'].title,
      description: REPORT_SECTIONS['course-insights'].description,
      blocks,
    }
    return NextResponse.json({ sections: [section] })
  } catch (error: any) {
    console.error('[reports/teach]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load teach reports' },
      { status: 500 }
    )
  }
}
