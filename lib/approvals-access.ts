/**
 * Registration approval access — assigned reviewers only.
 *
 * Who may approve for an institution:
 *   1. superadmin (all institutes)
 *   2. active row in registration_reviewers for that institution
 *
 * Teachers are NOT auto-approvers just because they teach or have an
 * institution_id. Superadmin assigns them on /admin/reviewers.
 */

export type ApprovalProfile = {
  id: string
  role?: string | null
  institution_id?: string | null
}

export function resolveEffectiveRole(
  profileRole: string | null | undefined,
  user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }
): string {
  const meta =
    (user.app_metadata?.role as string | undefined) ||
    (user.user_metadata?.role as string | undefined) ||
    null
  const profile = profileRole || null

  if (profile === 'superadmin' || meta === 'superadmin') {
    if (profile && meta && profile !== meta) {
      console.warn(
        '[approvals] role mismatch profile=%s metadata=%s — treating as superadmin',
        profile,
        meta
      )
    }
    return 'superadmin'
  }

  return profile || meta || 'student'
}

export function isSuperadminRole(role: string | null | undefined): boolean {
  return role === 'superadmin'
}

/** Coarse gate: may open the approvals API at all */
export async function getApprovalScope(supabase: any, userId: string, role: string) {
  if (isSuperadminRole(role)) {
    return { allowed: true as const, isSuper: true as const, institutionIds: [] as string[] }
  }

  const { data: reviewerRows } = await supabase
    .from('registration_reviewers')
    .select('institution_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  const institutionIds = (reviewerRows || [])
    .map((r: { institution_id: string }) => r.institution_id)
    .filter(Boolean)

  if (institutionIds.length === 0) {
    return { allowed: false as const, isSuper: false as const, institutionIds: [] as string[] }
  }

  return { allowed: true as const, isSuper: false as const, institutionIds }
}
