import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { assertLearnerCourseOpen } from '@/lib/course-access'
import { asAssistantDb } from '@/lib/ai/course-assistant'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const courseId = typeof body.courseId === 'string' ? body.courseId : ''
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : ''
  if (!courseId || !text) {
    return NextResponse.json({ error: 'courseId and text are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const access = await assertLearnerCourseOpen(
    service,
    courseId,
    user.id,
    user.role,
    'Enroll in this course to save prompts'
  )
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const db = asAssistantDb(service)
  const { data: existing } = await db
    .from('ai_saved_prompts')
    .select('id, text, created_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('text', text)
    .maybeSingle()
  if (existing && typeof existing === 'object') return NextResponse.json({ prompt: existing })

  const { data, error } = await db
    .from('ai_saved_prompts')
    .insert({ user_id: user.id, course_id: courseId, text })
    .select('id, text, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ prompt: data })
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await asAssistantDb(service)
    .from('ai_saved_prompts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
