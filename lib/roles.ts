export type UserRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'resource_person'
  | 'superadmin'

export const USER_ROLES: UserRole[] = [
  'student',
  'instructor',
  'admin',
  'resource_person',
  'superadmin',
]

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
  resource_person: 'Resource Person',
  superadmin: 'Superadmin',
}

export const ADMIN_ROLES: UserRole[] = ['admin', 'superadmin']
export const TEACHER_ROLES: UserRole[] = ['instructor', 'admin', 'resource_person', 'superadmin']

/** Profile role is the source of truth. Do not elevate from user_metadata. */
export function coerceUserRole(role?: string | null): UserRole {
  if (role && (USER_ROLES as string[]).includes(role)) return role as UserRole
  return 'student'
}

export const canAccessAdmin = (role?: string | null): boolean =>
  role === 'admin' || role === 'superadmin'

export const canAccessTeaching = (role?: string | null): boolean =>
  role === 'instructor' || role === 'admin' || role === 'resource_person' || role === 'superadmin'

/** Default home after login and when opening the learner dashboard. */
export function homePathForRole(role?: string | null): string {
  if (canAccessAdmin(role)) return '/admin/reports'
  if (role === 'instructor' || role === 'resource_person') return '/teach/dashboard'
  return '/dashboard'
}
