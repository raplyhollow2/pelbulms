import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export type UserRole =
  | 'student'
  | 'instructor'
  | 'admin'
  | 'resource_person'
  | 'superadmin'

/**
 * Superadmin sits at the top of the hierarchy and implicitly satisfies every
 * role requirement. Any check that a superadmin performs is granted.
 */
export const SUPERADMIN_ROLE: UserRole = 'superadmin'

export {
  ADMIN_ROLES,
  TEACHER_ROLES,
  canAccessAdmin,
  canAccessTeaching,
} from '@/lib/roles'

export interface RBACCheck {
  hasAccess: boolean
  userRole?: UserRole
  userId?: string
  error?: string
}

/**
 * Server-side RBAC check function
 * Use this in API routes and server actions to verify user permissions
 */
export async function checkRBAC(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<RBACCheck> {
  try {
    const supabase = await createSupabaseServerClient()

    // Authenticate the request against the Supabase Auth server (secure).
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        hasAccess: false,
        error: 'Unauthorized - No session found'
      }
    }

    // Prefer service client so RLS can never hide the caller's profile.
    // Fall back to the session client when service_role isn't configured
    // (common in local/dev after `vercel env pull` of Sensitive secrets).
    let profile: { role?: string } | null = null
    const service = await tryCreateServiceClient()
    if (service) {
      const { data } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      profile = data as any
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      profile = data as any
    }

    if (!profile) {
      return {
        hasAccess: false,
        error: 'User profile not found'
      }
    }

    const userRole = (profile as any).role as UserRole

    // Superadmin has top-level access and satisfies every requirement.
    const hasAccess =
      userRole === SUPERADMIN_ROLE || allowedRoles.includes(userRole)

    return {
      hasAccess,
      userRole,
      userId: user.id
    }
  } catch (error) {
    return {
      hasAccess: false,
      error: 'RBAC check failed'
    }
  }
}

/**
 * RBAC middleware wrapper for API routes
 * Usage: export const POST = withRBAC(handler, ['instructor', 'admin'])
 */
export function withRBAC(
  handler: (request: NextRequest, context: { userId: string; userRole: UserRole }) => Promise<NextResponse>,
  allowedRoles: UserRole[]
) {
  return async (request: NextRequest) => {
    const rbacCheck = await checkRBAC(request, allowedRoles)

    if (!rbacCheck.hasAccess) {
      return NextResponse.json(
        { error: rbacCheck.error || 'Access denied' },
        { status: rbacCheck.error === 'Unauthorized - No session found' ? 401 : 403 }
      )
    }

    return handler(request, {
      userId: rbacCheck.userId!,
      userRole: rbacCheck.userRole!
    })
  }
}

/**
 * Role check helpers for common scenarios
 */
export const isStudent = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['student'])

export const isInstructor = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['instructor'])

export const isAdmin = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['admin', 'superadmin'])

export const isSuperAdmin = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['superadmin'])

/** Client/server-safe role helpers live in lib/roles.ts (re-exported above). */

export const isTeacherOrAdmin = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])

export const isAnyAuthenticated = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['student', 'instructor', 'admin', 'resource_person', 'superadmin'])