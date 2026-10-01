// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runText } from '@/lib/ai/dispatch'
import { getRequestUser } from '@/lib/request-user'
import { assertLearnerCourseOpen } from '@/lib/course-access'
import { answerCourseTutor, asAssistantDb, isAssistantTask } from '@/lib/ai/course-assistant'

export const maxDuration = 300

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
  const access = await assertLearnerCourseOpen(
    service,
    courseId,
    user.id,
    user.role,
    'Enroll in this course to use the tutor'
  )
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
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
