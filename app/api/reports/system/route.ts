import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { computeSystemPulseReports } from '@/lib/reports/compute-system'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type { ReportSectionPayload } from '@/lib/reports/types'

/** GET /api/reports/system — System Pulse (superadmin / developer audience) */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ['superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Forbidden' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const db = await getDbClient()
    const blocks = await computeSystemPulseReports(db as any)
    const section: ReportSectionPayload = {
      section: 'system-pulse',
      title: REPORT_SECTIONS['system-pulse'].title,
      description: REPORT_SECTIONS['system-pulse'].description,
      blocks,
    }
    return NextResponse.json({ sections: [section] })
  } catch (error: any) {
    console.error('[reports/system]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load system reports' },
      { status: 500 }
    )
  }
}
