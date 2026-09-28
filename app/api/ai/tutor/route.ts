import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runText } from '@/lib/ai/dispatch'
import { getRequestUser } from '@/lib/request-user'
import { answerCourseTutor, asAssistantDb, isAssistantTask } from '@/lib/ai/course-assistant'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const courseId = typeof body.courseId === 'string' ? body.courseId : ''
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : null
  const activityId = typeof body.activityId === 'string' ? body.activityId : null
  const question = typeof body.question === 'string' ? body.question : ''
  const task = isAssistantTask(body.task) ? body.task : 'chat'
  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: enrollment } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = enrollment?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return NextResponse.json({ error: 'Enroll in this course to use the tutor' }, { status: 403 })
  }

  try {
    const result = await answerCourseTutor(asAssistantDb(service), runText, {
      userId: user.id,
      courseId,
      lessonId,
      activityId,
      task,
      question,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      answer: result.answer,
      tutorName: result.tutorName,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      artifact: result.artifact,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tutor unavailable. A superadmin needs to configure AI.'
    const status =
      error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
