/**
 * Notify platform approvers when a new registration is submitted.
 */

export type RegistrationNotifyInput = {
  applicantName: string
  applicantEmail?: string | null
  institutionId: string
  institutionName?: string | null
  registrationUserId: string
}

/** Resolve who should be notified for a given institute registration. */
export async function resolveApproverRecipientIds(
  service: any,
  institutionId: string
): Promise<string[]> {
  const ids = new Set<string>()

  const { data: globals } = await service
    .from('profiles')
    .select('id')
    .in('role', ['superadmin', 'admin'])

  for (const p of globals || []) {
    if (p.id) ids.add(p.id)
  }

  const { data: institution } = await service
    .from('institutions')
    .select('id, name, display_name, resource_person_id')
    .eq('id', institutionId)
    .maybeSingle()

  if (institution?.resource_person_id) {
    ids.add(institution.resource_person_id)
  }

  const { data: homeRps } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'resource_person')
    .eq('institution_id', institutionId)

  for (const p of homeRps || []) {
    if (p.id) ids.add(p.id)
  }

  const { data: reviewers } = await service
    .from('registration_reviewers')
    .select('user_id')
    .eq('institution_id', institutionId)
    .eq('is_active', true)

  for (const r of reviewers || []) {
    if (r.user_id) ids.add(r.user_id)
  }

  return Array.from(ids)
}

export async function notifyApproversOfRegistration(
  service: any,
  input: RegistrationNotifyInput
): Promise<{ notified: number }> {
  const recipientIds = await resolveApproverRecipientIds(service, input.institutionId)
  // Never notify the applicant about their own submission
  const targets = recipientIds.filter((id) => id !== input.registrationUserId)

  if (targets.length === 0) return { notified: 0 }

  let institutionLabel = input.institutionName
  if (!institutionLabel) {
    const { data: inst } = await service
      .from('institutions')
      .select('name, display_name')
      .eq('id', input.institutionId)
      .maybeSingle()
    institutionLabel = inst?.display_name || inst?.name || 'your institution'
  }

  const title = 'New registration pending approval'
  const message = `${input.applicantName}${
    input.applicantEmail ? ` (${input.applicantEmail})` : ''
  } submitted a registration for ${institutionLabel}.`

  const rows = targets.map((user_id) => ({
    user_id,
    type: 'registration_pending',
    title,
    message,
    action_url: '/admin/users?tab=approvals',
    is_read: false,
    metadata: {
      institution_id: input.institutionId,
      applicant_user_id: input.registrationUserId,
      applicant_name: input.applicantName,
    },
  }))

  const { error } = await service.from('notifications').insert(rows)
  if (error) {
    console.error('[notify] failed to insert registration notifications:', error)
    return { notified: 0 }
  }

  return { notified: rows.length }
}
