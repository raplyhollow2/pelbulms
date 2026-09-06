/**
 * Registration approval access.
 *
 * Who may approve:
 *   1. superadmin / admin — all institutes (student KYC)
 *   2. resource_person — institutes they are assigned to (student KYC)
 *   3. active registration_reviewers row — explicitly assigned helpers
 *   4. Teaching roles (instructor / resource_person) — Superadmin only
 *
 * Regular instructors are NOT auto-approvers unless assigned as reviewers.
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

  // Prefer elevated roles from either source so stale profile sync can't lock out superadmin.
  const elevated = ['superadmin', 'admin', 'resource_person'] as const
  for (const r of elevated) {
    if (profile === r || meta === r) {
      if (profile && meta && profile !== meta) {
        console.warn(
          '[approvals] role mismatch profile=%s metadata=%s — using %s',
          profile,
          meta,
          r
        )
      }
      return r
    }
  }

  return profile || meta || 'student'
}

export function isGlobalApproverRole(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin'
}

export function isSuperadminRole(role: string | null | undefined): boolean {
  return role === 'superadmin'
}

export function canSeeApprovalsNav(role: string | null | undefined, assignedReviewer: boolean): boolean {
  return isGlobalApproverRole(role) || role === 'resource_person' || assignedReviewer
}

export type ApprovalScope =
  | {
      allowed: true
      isSuper: boolean
      isSuperadmin: boolean
      institutionIds: string[]
    }
  | {
      allowed: false
      isSuper: false
      isSuperadmin: false
      institutionIds: string[]
    }

/** Coarse gate: may open the approvals API at all */
export async function getApprovalScope(
  supabase: any,
  userId: string,
  role: string,
  profileInstitutionId?: string | null
): Promise<ApprovalScope> {
  const isSuperadmin = isSuperadminRole(role)

  // Platform admins see every institute's student queue
  if (isGlobalApproverRole(role)) {
    return {
      allowed: true as const,
      isSuper: true as const,
      isSuperadmin,
      institutionIds: [] as string[],
    }
  }

  const institutionIds = new Set<string>()

  // Explicit reviewer assignments
  const { data: reviewerRows } = await supabase
    .from('registration_reviewers')
    .select('institution_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  for (const r of reviewerRows || []) {
    if (r.institution_id) institutionIds.add(r.institution_id)
  }

  // Resource persons: home institute + institutes where they are the designated RP
  if (role === 'resource_person') {
    if (profileInstitutionId) institutionIds.add(profileInstitutionId)

    const { data: rpInstitutions } = await supabase
      .from('institutions')
      .select('id')
      .eq('resource_person_id', userId)

    for (const i of rpInstitutions || []) {
      if (i.id) institutionIds.add(i.id)
    }

    const { data: accessRows } = await supabase
      .from('institution_access')
      .select('institution_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    for (const a of accessRows || []) {
      if (a.institution_id) institutionIds.add(a.institution_id)
    }
  }

  const ids = Array.from(institutionIds)

  if (ids.length === 0) {
    return {
      allowed: false as const,
      isSuper: false as const,
      isSuperadmin: false as const,
      institutionIds: [] as string[],
    }
  }

  return {
    allowed: true as const,
    isSuper: false as const,
    isSuperadmin: false as const,
    institutionIds: ids,
  }
}
