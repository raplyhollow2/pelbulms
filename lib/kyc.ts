export const TEACHING_REQUEST_ROLES = ['instructor', 'resource_person'] as const
export const KYC_EXEMPT_ROLES = ['admin', 'superadmin'] as const

export function isTeachingRequestRole(role?: string | null): boolean {
  return role === 'instructor' || role === 'resource_person'
}

export function isKycExemptRole(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin'
}

/** Staff-provisioned teaching roles that may use /teach without a KYC row. */
export function isTeachingPlatformRole(role?: string | null): boolean {
  return (
    role === 'instructor' ||
    role === 'resource_person' ||
    role === 'admin' ||
    role === 'superadmin'
  )
}
