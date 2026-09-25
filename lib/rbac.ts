import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'

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
    const user = await getRequestUser(request)
    if (!user) {
      return {
        hasAccess: false,
        error: 'Unauthorized - No session found'
      }
    }

    let userRole = user.role
    if (!userRole) {
      // Legacy accounts have no role in auth metadata. profiles is the source.
      const supabase = await createSupabaseServerClient()
      const service = await tryCreateServiceClient()
      const db = service || supabase
      const { data } = await db
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      userRole = ((data as { role?: string } | null)?.role || null) as UserRole | null
    }

    if (!userRole) {
      return {
        hasAccess: false,
        error: 'User profile not found'
      }
    }

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

/** Capability-based checks (Phase 1 permissions). Prefer these for new admin APIs. */
export {
  checkCapability,
  capabilityDenied,
  resolveUserCapabilities,
  hasCapability,
  enforceCapability,
  catalogGrantsActive,
  CAP,
} from '@/lib/capabilities'