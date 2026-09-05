// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { userCanManageCourse } from '@/lib/course-access'
import { notifyEnrolledStudents } from '@/lib/notify-enrolled'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

/**
 * POST /api/courses/[courseId]/notify-learners
 * Body: { title, message, lessonId?, type? }
 * Teachers notify enrolled learners (e.g. activity added/updated).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const rbac = await checkRBAC(request, [...TEACHER_ROLES])
    if (!rbac.hasAccess) {
      return NextResponse.json(
        { error: rbac.error || 'Access denied' },
        { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
      )
    }

    const db = await getDbClient()
    if (!(await userCanManageCourse(db, courseId, rbac.userId!, rbac.userRole))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    const lessonId = typeof body.lessonId === 'string' ? body.lessonId : null
    const count = await notifyEnrolledStudents(db, {
      courseId,
      type: body.type || 'activity_update',
      title,
      message,
      actionUrl: lessonId
        ? `/learn/${courseId}/lesson/${lessonId}`
        : `/learn/${courseId}`,
    })

    return NextResponse.json({ success: true, notified: count })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to notify learners' },
      { status: 500 }
    )
  }
}
