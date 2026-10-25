import { NextRequest, NextResponse } from 'next/server'
import { assertLearnerCourseOpen, courseIdByLesson } from '@/lib/course-access'
import { recordLessonLeave } from '@/lib/lesson-resume'
import { getRequestUser } from '@/lib/request-user'
import { tryCreateServiceClient } from '@/lib/supabase/server'

function clampPercent(value: unknown) {
  const percent = Math.round(Number(value))
  if (!Number.isFinite(percent)) return null
  return Math.max(0, Math.min(100, percent))
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const lessonId = typeof body?.lessonId === 'string' ? body.lessonId : ''
  const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
  const finished = body?.finished === true
  const percent = finished ? 0 : clampPercent(body?.percent)
  const positionSeconds = Math.max(0, Math.round(Number(body?.positionSeconds) || 0))

  if (!lessonId || !courseId || (!finished && percent == null)) {
    return NextResponse.json({ error: 'lessonId, courseId, and percent are required' }, { status: 400 })
  }

  const service = await tryCreateServiceClient()
  if (!service) return NextResponse.json({ error: 'Progress could not be saved' }, { status: 503 })

  const lessonCourseId = await courseIdByLesson(service, lessonId)
  if (!lessonCourseId || lessonCourseId !== courseId) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const access = await assertLearnerCourseOpen(
    service,
    courseId,
    user.id,
    user.role,
    'You are not enrolled in this course'
  )
  if (access.ok === false) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const { data: enrollment } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = (enrollment as { status?: string } | null)?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return NextResponse.json({ error: 'You are not enrolled in this course' }, { status: 403 })
  }

  const result = await recordLessonLeave({
    userId: user.id,
    lessonId,
    courseId,
    percent: percent ?? 0,
    positionSeconds,
    leaving: body?.leaving === true,
    finished,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 })
  }
  return NextResponse.json({ ok: true, percent: result.percent })
}
