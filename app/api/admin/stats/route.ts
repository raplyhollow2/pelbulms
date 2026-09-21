import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { ADMIN_ROLES } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase/server'
import { computePlatformStats } from '@/lib/admin/platform-stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const rbac = await enforceCapability(
    request,
    [CAP.DASHBOARD_VIEW, CAP.REPORTS_VIEW],
    ADMIN_ROLES
  )
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const db = await createServiceClient()
    const stats = await computePlatformStats(db as any)
    return NextResponse.json(
      { live: true, stats },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error: any) {
    console.error('[admin/stats]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to load platform stats' },
      { status: 500 }
    )
  }
}
