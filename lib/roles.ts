export type UserRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'resource_person'
  | 'superadmin'

export const ADMIN_ROLES: UserRole[] = ['admin', 'superadmin']
export const TEACHER_ROLES: UserRole[] = ['instructor', 'admin', 'resource_person', 'superadmin']

export const canAccessAdmin = (role?: string | null): boolean =>
  role === 'admin' || role === 'superadmin'

export const canAccessTeaching = (role?: string | null): boolean =>
  role === 'instructor' || role === 'admin' || role === 'resource_person' || role === 'superadmin'
