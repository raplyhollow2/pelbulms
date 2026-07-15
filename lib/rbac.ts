import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export type UserRole = 'student' | 'instructor' | 'admin'

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
    const supabase = createSupabaseServerClient()

    // Get user session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return {
        hasAccess: false,
        error: 'Unauthorized - No session found'
      }
    }

    // Get user profile with role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      return {
        hasAccess: false,
        error: 'User profile not found'
      }
    }

    const userRole = (profile as any).role as UserRole

    // Check if user's role is in the allowed roles
    const hasAccess = allowedRoles.includes(userRole)

    return {
      hasAccess,
      userRole,
      userId: session.user.id
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
  checkRBAC(request, ['admin'])

export const isTeacherOrAdmin = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['instructor', 'admin'])

export const isAnyAuthenticated = async (request: NextRequest): Promise<RBACCheck> =>
  checkRBAC(request, ['student', 'instructor', 'admin'])