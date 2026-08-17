// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { geminiText } from '@/lib/gemini'
import { parseLessonBlocks, readCourseAiMetadata } from '@/lib/lesson-blocks'

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

  const { data: course } = await service
    .from('courses')
    .select('title, description, metadata, instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  const tutor = readCourseAiMetadata((course as any)?.metadata).tutor
  const { data: modules } = await service
    .from('modules')
    .select('id, title')
    .eq('course_id', courseId)
    .order('order_index')
  const moduleIds = (modules || []).map((m: any) => m.id)
  let lessonTitles = ''
  if (moduleIds.length) {
    const { data: lessons } = await service
      .from('lessons')
      .select('title, module_id')
      .in('module_id', moduleIds)
      .order('order_index')
    lessonTitles = (lessons || [])
      .map((l: any) => `- ${l.title}`)
      .join('\n')
      .slice(0, 4000)
  }

  let lessonContext = ''
  if (lessonId) {
    const { data: lesson } = await service
      .from('lessons')
      .select('title, description, content')
      .eq('id', lessonId)
      .maybeSingle()
    if (lesson) {
      const blocks = parseLessonBlocks((lesson as any).content)
      const text = blocks
        .map((b: any) => (b.type === 'text' ? b.html : b.type === 'flipcards' ? JSON.stringify(b.cards) : b.type))
        .join('\n')
        .replace(/<[^>]+>/g, ' ')
        .slice(0, 6000)
      lessonContext = `Current lesson: ${(lesson as any).title}\n${(lesson as any).description || ''}\n${text}`
    }
  }

  const name = tutor?.name || 'Course tutor'
  const extra = tutor?.instructions || 'Answer only from this course. If the question is off-topic, politely redirect.'

  try {
    const answer = await geminiText(
      `You are ${name}, the AI tutor trained on this Pelbu LMS course.
${extra}

Course: ${(course as any)?.title}
Description: ${(course as any)?.description || ''}
Outline:
${(modules || []).map((m: any) => m.title).join('\n')}
Lessons:
${lessonTitles}

${lessonContext}

Student question: ${question}`,
      { userId: (course as any)?.instructor_id || user.id }
    )
    return NextResponse.json({ answer, tutorName: name })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Tutor unavailable. Add a Gemini API key in Settings → AI.' },
      { status: 500 }
    )
  }
}
