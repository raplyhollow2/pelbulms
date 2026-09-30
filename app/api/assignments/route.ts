// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC, TEACHER_ROLES } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { authorizeLessonManage } from '@/lib/authoring'
import { assertLearnerCourseOpen, courseIdByLesson } from '@/lib/course-access'

/**
 * GET /api/assignments?id=...
 * Teachers managing the lesson, and enrolled learners, can read one assignment.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const rbac = await checkRBAC(request, ['student', ...TEACHER_ROLES])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json({ error: rbac.error || 'Unauthorized' }, { status: 401 })
  }

  const db = await getDbClient()
  const { data, error } = await db.from('assignments').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  const lessonId = (data as { lesson_id?: string }).lesson_id
  const courseId = lessonId ? await courseIdByLesson(db, lessonId) : null
  if (!courseId) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  const access = await assertLearnerCourseOpen(
    db,
    courseId,
    rbac.userId,
    rbac.userRole,
    'Enroll in this course to view the assignment'
  )
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data: submission } = await db
    .from('assignment_submissions')
    .select('id, content, submitted_at, status, grade, feedback')
    .eq('assignment_id', id)
    .eq('user_id', rbac.userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ assignment: data, submission: submission || null })
}

/**
 * POST /api/assignments
 * Create or update the assignment attached to a lesson block.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json({ error: rbac.error || 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  const maxPoints = Number(body.maxPoints)
  const dueDate = typeof body.dueDate === 'string' && body.dueDate ? body.dueDate : null
  const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : ''

  if (!lessonId || !title) {
    return NextResponse.json({ error: 'A lesson and title are required' }, { status: 400 })
  }

  const db = await getDbClient()
  const auth = await authorizeLessonManage(db, lessonId, rbac.userId, rbac.userRole)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const payload = {
    lesson_id: lessonId,
    title,
    description: instructions || null,
    instructions: instructions || null,
    max_points: Number.isFinite(maxPoints) && maxPoints > 0 ? Math.round(maxPoints) : 100,
    due_date: dueDate,
    is_published: true,
    updated_at: new Date().toISOString(),
  }

  if (assignmentId) {
    const { data, error } = await db
      .from('assignments')
      .update(payload)
      .eq('id', assignmentId)
      .eq('lesson_id', lessonId)
      .select('*')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    return NextResponse.json({ assignment: data })
  }

  const { data, error } = await db.from('assignments').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ assignment: data })
}
