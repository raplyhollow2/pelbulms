import { NextRequest, NextResponse } from 'next/server'
import { withRBAC } from '@/lib/rbac'

/**
 * GET /api/users - Get all users (Admin only)
 * Protected by RBAC middleware
 */
export const GET = withRBAC(
  async (request, { userId, userRole }) => {
    // This function only runs if user is an admin
    return NextResponse.json({
      message: 'Admin access granted',
      userId,
      userRole,
      timestamp: new Date().toISOString()
    })
  },
  ['admin']
)

/**
 * POST /api/users - Create user (Admin only)
 * Protected by RBAC middleware
 */
export const POST = withRBAC(
  async (request, { userId, userRole }) => {
    try {
      const body = await request.json()

      // User creation logic would go here
      // For now, just echo back the request
      return NextResponse.json({
        message: 'User creation endpoint',
        createdBy: userId,
        role: userRole,
        userData: body
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
  },
  ['admin']
)