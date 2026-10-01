// @ts-nocheck — existing Supabase and UI type drift; remove when database types are regenerated.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { assertLearnerCourseOpen } from '@/lib/course-access'
import { asAssistantDb, loadAssistantState } from '@/lib/ai/course-assistant'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = request.nextUrl.searchParams.get('courseId') || ''
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
    const state = await loadAssistantState(asAssistantDb(service), user.id, courseId)
    return NextResponse.json(state)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not load the assistant'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
