import { NextRequest, NextResponse } from 'next/server'
import { withRBAC } from '@/lib/rbac'

/**
 * GET /api/teach/courses - Get teacher's courses (Instructor/Admin only)
 * Protected by RBAC middleware
 */
export const GET = withRBAC(
  async (request, { userId, userRole }) => {
    // This function only runs if user is instructor or admin
    return NextResponse.json({
      message: 'Teacher courses endpoint',
      teacherId: userId,
      role: userRole,
      timestamp: new Date().toISOString()
    })
  },
  ['instructor', 'admin']
)

/**
 * POST /api/teach/courses - Create course (Instructor/Admin only)
 * Protected by RBAC middleware
 */
export const POST = withRBAC(
  async (request, { userId, userRole }) => {
    try {
      const body = await request.json()

      // Course creation logic would go here
      return NextResponse.json({
        message: 'Course creation endpoint',
        createdBy: userId,
        role: userRole,
        courseData: body
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
  },
  ['instructor', 'admin']
)