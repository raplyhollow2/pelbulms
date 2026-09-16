import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { computeStudentReports } from '@/lib/reports/compute-student'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type { ReportSectionPayload } from '@/lib/reports/types'

/** GET /api/reports/student — My Learning reports for the signed-in user */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [
    'student',
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
    const blocks = await computeStudentReports(db as any, rbac.userId)
    const section: ReportSectionPayload = {
      section: 'my-learning',
      title: REPORT_SECTIONS['my-learning'].title,
      description: REPORT_SECTIONS['my-learning'].description,
      blocks,
    }
    return NextResponse.json({ sections: [section] })
  } catch (error: any) {
    console.error('[reports/student]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load student reports' },
      { status: 500 }
    )
  }
}
