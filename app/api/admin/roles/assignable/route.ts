// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { CAP, capabilityDenied, checkCapability } from '@/lib/capabilities'
import { listRoles } from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/roles/assignable
 * Roles that can be assigned in the Users admin (system + custom assignable).
 */
export async function GET(request: NextRequest) {
  const check = await checkCapability(request, [CAP.USERS_VIEW, CAP.USERS_ADD, CAP.USERS_EDIT])
  if (!check.hasAccess) {
    // Fallback for admins before capability seeds exist
    if (check.userRole !== 'admin' && check.userRole !== 'superadmin') {
      return capabilityDenied(check)
    }
  }

  try {
    const service = await createServiceClient()
    const roles = await listRoles(service as any)
    const assignable = roles.filter((r) => r.is_assignable)
    return NextResponse.json({ roles: assignable })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to list roles' },
      { status: 500 }
    )
  }
}
