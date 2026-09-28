import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { asAssistantDb, loadAssistantState } from '@/lib/ai/course-assistant'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = request.nextUrl.searchParams.get('courseId') || ''
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
    const state = await loadAssistantState(asAssistantDb(service), user.id, courseId)
    return NextResponse.json(state)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not load the assistant'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
