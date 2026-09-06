import { isKycExemptRole } from '@/lib/kyc'

type ProfileRow = {
  account_status?: string | null
  role?: string | null
}

type RegistrationRow = {
  registration_status?: string | null
}

/**
 * Where to send a user after login. Pending accounts stay on KYC screens
 * until identity is approved. Rejected/suspended go to access-denied.
 */
export function destinationPathForAccount(opts: {
  accountStatus?: string | null
  role?: string | null
  registrationStatus?: string | null
}): string {
  const status = opts.accountStatus || 'pending'
  const role = opts.role || 'student'

  if (status === 'rejected' || status === 'suspended') {
    return '/auth/access-denied'
  }

  if (isKycExemptRole(role) || status === 'active') {
    return '/dashboard'
  }

  // pending (and any unknown status for new users)
  if (!opts.registrationStatus || opts.registrationStatus === 'draft') {
    return '/auth/register'
  }
  if (opts.registrationStatus === 'additional_info_requested') {
    return '/auth/register'
  }
  if (opts.registrationStatus === 'approved') {
    return '/dashboard'
  }
  return '/auth/pending-approval'
}

export async function resolvePostLoginPath(
  service: {
    from: (table: string) => any
  },
  userId: string
): Promise<string> {
  const { data: profile } = await service
    .from('profiles')
    .select('account_status, role')
    .eq('id', userId)
    .maybeSingle()

  const row = (profile || {}) as ProfileRow

  const { data: registration } = await service
    .from('student_registrations')
    .select('registration_status')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return destinationPathForAccount({
    accountStatus: row.account_status,
    role: row.role,
    registrationStatus: (registration as RegistrationRow | null)?.registration_status,
  })
}
