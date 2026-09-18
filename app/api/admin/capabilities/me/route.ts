// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import {
  CAP,
  hasCapability,
  resolveUserCapabilities,
} from '@/lib/capabilities'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/capabilities/me
 * Returns the current user's resolved capability keys for nav gating.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolved = await resolveUserCapabilities(user.id)
    return NextResponse.json({
      role: resolved.userRole,
      roleSlug: resolved.roleSlug,
      baseArchetype: resolved.baseArchetype,
      allInstitutions: resolved.allInstitutions,
      institutionIds: resolved.institutionIds,
      capabilities: resolved.capabilityKeys.has('*')
        ? ['*']
        : Array.from(resolved.capabilityKeys),
      canAdminNav:
        hasCapability(resolved, CAP.USERS_VIEW) ||
        hasCapability(resolved, CAP.REPORTS_VIEW) ||
        hasCapability(resolved, CAP.SETTINGS_VIEW) ||
        hasCapability(resolved, CAP.PERMISSIONS_VIEW) ||
        hasCapability(resolved, CAP.AI_VIEW),
      canApprovals: hasCapability(resolved, CAP.APPROVALS_VIEW),
      canPermissions: hasCapability(resolved, CAP.PERMISSIONS_VIEW),
      canAi: hasCapability(resolved, CAP.AI_VIEW),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve capabilities' },
      { status: 500 }
    )
  }
}
