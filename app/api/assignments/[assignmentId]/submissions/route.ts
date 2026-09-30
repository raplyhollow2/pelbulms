// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC, TEACHER_ROLES } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { assertLearnerCourseOpen, courseIdByLesson } from '@/lib/course-access'

/**
 * POST /api/assignments/:assignmentId/submissions
 * Learner submits written work for an assignment block.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const rbac = await checkRBAC(request, ['student', ...TEACHER_ROLES])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json({ error: rbac.error || 'Unauthorized' }, { status: 401 })
  }

  const { assignmentId } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'Write a response before submitting' }, { status: 400 })

  const db = await getDbClient()
  const { data: assignment } = await db
    .from('assignments')
    .select('id, lesson_id, is_published')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  const lessonId = (assignment as { lesson_id?: string }).lesson_id
  const courseId = lessonId ? await courseIdByLesson(db, lessonId) : null
  if (!courseId) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  const access = await assertLearnerCourseOpen(
    db,
    courseId,
    rbac.userId,
    rbac.userRole,
    'Enroll in this course to submit the assignment'
  )
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data: enrollment } = await db
    .from('enrollments')
    .select('id')
    .eq('user_id', rbac.userId)
    .eq('course_id', courseId)
    .maybeSingle()

  const { data, error } = await db
    .from('assignment_submissions')
    .insert({
      assignment_id: assignmentId,
      user_id: rbac.userId,
      enrollment_id: (enrollment as { id?: string } | null)?.id || null,
      content,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .select('id, content, submitted_at, status, grade, feedback')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ submission: data })
}
