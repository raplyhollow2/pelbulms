// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { geminiText } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  const auth = await createSupabaseServerClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string
  const lessonId = body.lessonId as string | undefined
  const question = String(body.question || '').trim()
  if (!courseId || !question) {
    return NextResponse.json({ error: 'courseId and question are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: enrollment } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = (enrollment as any)?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return NextResponse.json({ error: 'Enroll in this course to use the tutor' }, { status: 403 })
  }

  const { data: course } = await service.from('courses').select('title, description').eq('id', courseId).maybeSingle()
  let lessonContext = ''
  if (lessonId) {
    const { data: lesson } = await service
      .from('lessons')
      .select('title, description')
      .eq('id', lessonId)
      .maybeSingle()
    if (lesson) {
      lessonContext = `Current lesson: ${(lesson as any).title}\n${(lesson as any).description || ''}`
    }
  }

  try {
    const answer = await geminiText(
      `You are the Pelbu LMS tutor for the course “${(course as any)?.title}”.
Course description: ${(course as any)?.description || ''}
${lessonContext}

Answer only from this course context. If the question is off-topic, politely redirect.
Student question: ${question}`,
      'gemini-2.0-flash'
    )
    return NextResponse.json({ answer })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Tutor unavailable. Set GEMINI_API_KEY.' },
      { status: 500 }
    )
  }
}
