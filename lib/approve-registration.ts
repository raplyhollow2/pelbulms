/**
 * Server-side registration review using the service client.
 *
 * The legacy RPC checks is_registration_reviewer() which may be out of date in
 * deployed databases (migration 033 not applied). The approvals API already
 * validates caller permissions via getApprovalScope(), so we perform the writes
 * here with the service role instead.
 */

type ReviewAction = 'approve' | 'reject' | 'request_info'

const APPROVABLE_STATUSES = new Set([
  'submitted',
  'under_review',
  'additional_info_requested',
])

const TEACHER_ROLES = new Set(['instructor', 'admin', 'resource_person'])

export type RegistrationReviewResult =
  | { success: true; message: string; user_id?: string; registration_id: string; assigned_role?: string }
  | { success: false; error: string }

type Scope = { isSuper: boolean; institutionIds: string[] }

export async function processRegistrationReview(
  service: any,
  opts: {
    registrationId: string
    action: ReviewAction
    reviewerId: string
    reviewNotes?: string | null
    rejectionReason?: string | null
    assignedRole?: string | null
    scope: Scope
  }
): Promise<RegistrationReviewResult> {
  const {
    registrationId,
    action,
    reviewerId,
    reviewNotes,
    rejectionReason,
    assignedRole,
    scope,
  } = opts

  const { data: reg, error: regError } = await service
    .from('student_registrations')
    .select('*')
    .eq('id', registrationId)
    .maybeSingle()

  if (regError || !reg) {
    return { success: false, error: 'Registration not found' }
  }

  if (!scope.isSuper && !scope.institutionIds.includes(reg.institution_id)) {
    return { success: false, error: 'Institution access denied' }
  }

  const now = new Date().toISOString()

  if (action === 'request_info') {
    const { error } = await service
      .from('student_registrations')
      .update({
        registration_status: 'additional_info_requested',
        reviewed_by: reviewerId,
        reviewed_at: now,
        review_notes: reviewNotes || null,
        updated_at: now,
      })
      .eq('id', registrationId)

    if (error) return { success: false, error: error.message }
    return {
      success: true,
      message: 'Additional information requested',
      registration_id: registrationId,
    }
  }

  if (action === 'reject') {
    const { error: regUpdateError } = await service
      .from('student_registrations')
      .update({
        registration_status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: now,
        review_notes: reviewNotes || null,
        rejection_reason: rejectionReason || null,
        updated_at: now,
      })
      .eq('id', registrationId)

    if (regUpdateError) return { success: false, error: regUpdateError.message }

    await service
      .from('profiles')
      .update({ account_status: 'rejected', updated_at: now })
      .eq('id', reg.user_id)

    await service.from('user_approvals').upsert(
      {
        user_id: reg.user_id,
        institution_id: reg.institution_id,
        approval_status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: now,
        rejection_reason: rejectionReason || null,
        notes: `Rejected: ${reviewNotes || 'No notes'}`,
      },
      { onConflict: 'user_id,institution_id' }
    )

    await mergeAuthAppMetadata(service, reg.user_id, { account_status: 'rejected' })

    return {
      success: true,
      message: 'Registration rejected',
      registration_id: registrationId,
    }
  }

  if (action === 'approve') {
    if (!APPROVABLE_STATUSES.has(reg.registration_status)) {
      return { success: false, error: 'Registration not in approvable state' }
    }

    const finalRole = assignedRole || reg.requested_role || 'student'
    const institutionRole = TEACHER_ROLES.has(finalRole) ? 'teacher' : 'student'

    const { error: regUpdateError } = await service
      .from('student_registrations')
      .update({
        registration_status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: now,
        review_notes: reviewNotes || null,
        updated_at: now,
      })
      .eq('id', registrationId)

    if (regUpdateError) return { success: false, error: regUpdateError.message }

    const { data: existingProfile } = await service
      .from('profiles')
      .select('metadata')
      .eq('id', reg.user_id)
      .maybeSingle()

    const existingMetadata =
      existingProfile?.metadata && typeof existingProfile.metadata === 'object'
        ? existingProfile.metadata
        : {}

    const { error: profileError } = await service
      .from('profiles')
      .update({
        account_status: 'active',
        role: finalRole,
        institution_id: reg.institution_id,
        enrollment_date: now,
        full_name: reg.full_name,
        location: reg.dzongkhag,
        metadata: {
          ...existingMetadata,
          cid_number: reg.cid_number,
          pelsung_number: reg.pelsung_number,
          class: reg.class,
          phone_number: reg.phone_number,
        },
        updated_at: now,
      })
      .eq('id', reg.user_id)

    if (profileError) return { success: false, error: profileError.message }

    await service.from('institution_access').upsert(
      {
        institution_id: reg.institution_id,
        user_id: reg.user_id,
        role_within_institution: institutionRole,
        granted_by: reviewerId,
        granted_at: now,
        is_active: true,
      },
      { onConflict: 'institution_id,user_id' }
    )

    await service.from('user_approvals').upsert(
      {
        user_id: reg.user_id,
        institution_id: reg.institution_id,
        approval_status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: now,
        notes: `Approved as ${finalRole}: ${reviewNotes || 'No notes'}`,
      },
      { onConflict: 'user_id,institution_id' }
    )

    await mergeAuthAppMetadata(service, reg.user_id, {
      account_status: 'active',
      role: finalRole,
      institution_id: String(reg.institution_id),
    })

    return {
      success: true,
      message: `Registration approved as ${finalRole}`,
      user_id: reg.user_id,
      assigned_role: finalRole,
      registration_id: registrationId,
    }
  }

  return { success: false, error: 'Invalid action' }
}

async function mergeAuthAppMetadata(
  service: any,
  userId: string,
  patch: Record<string, string>
) {
  const { data } = await service.auth.admin.getUserById(userId)
  const current = (data?.user?.app_metadata as Record<string, unknown>) || {}
  await service.auth.admin.updateUserById(userId, {
    app_metadata: { ...current, ...patch },
  })
}
