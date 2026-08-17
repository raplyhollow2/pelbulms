// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { geminiJson } from '@/lib/gemini'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

type Generated = {
  title: string
  description: string
  modules: Array<{
    title: string
    description?: string
    lessons: Array<{
      title: string
      description?: string
      content?: string
      quiz?: {
        title: string
        questions: Array<{
          question: string
          options: string[]
          correctIndex: number
        }>
      }
    }>
  }>
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string | undefined
  const prompt = String(body.prompt || '').trim()
  const documentText = String(body.documentText || '').trim()
  if (!courseId || (!prompt && !documentText)) {
    return NextResponse.json({ error: 'courseId and prompt or documentText are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let generated: Generated
  try {
    generated = await geminiJson<Generated>(
      `You are an instructional designer for Pelbu LMS (Bhutan). Create a practical course outline.
Topic / brief: ${prompt || 'From the attached document'}
Document (optional): ${documentText.slice(0, 20000)}

JSON shape:
{
  "title": string,
  "description": string,
  "modules": [
    {
      "title": string,
      "description": string,
      "lessons": [
        {
          "title": string,
          "description": string,
          "content": string,
          "quiz": {
            "title": string,
            "questions": [
              { "question": string, "options": [string, string, string, string], "correctIndex": 0 }
            ]
          }
        }
      ]
    }
  ]
}
Create 3-6 modules, 2-4 lessons each, one short MCQ quiz per lesson (3-5 questions).`
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Gemini generation failed. Set GEMINI_API_KEY.' },
      { status: 500 }
    )
  }

  const { data: existingModules } = await service
    .from('modules')
    .select('order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: false })
    .limit(1)
  let moduleOrder = ((existingModules?.[0] as any)?.order_index ?? -1) + 1

  const created: { modules: number; lessons: number; quizzes: number } = {
    modules: 0,
    lessons: 0,
    quizzes: 0,
  }

  for (const mod of generated.modules || []) {
    const { data: moduleRow, error: modErr } = await service
      .from('modules')
      .insert({
        course_id: courseId,
        title: mod.title,
        description: mod.description || null,
        order_index: moduleOrder++,
        is_published: false,
      })
      .select()
      .single()
    if (modErr || !moduleRow) continue
    created.modules++

    let lessonOrder = 0
    for (const les of mod.lessons || []) {
      const { data: lessonRow, error: lesErr } = await service
        .from('lessons')
        .insert({
          module_id: (moduleRow as any).id,
          title: les.title,
          description: les.description || les.content || null,
          order_index: lessonOrder++,
          is_published: false,
          duration_minutes: 0,
          resources: [],
        })
        .select()
        .single()
      if (lesErr || !lessonRow) continue
      created.lessons++

      if (les.quiz?.questions?.length) {
        const { data: quizRow } = await service
          .from('quizzes')
          .insert({
            lesson_id: (lessonRow as any).id,
            title: les.quiz.title || `${les.title} quiz`,
            passing_score: 70,
            max_attempts: 3,
            is_published: true,
          })
          .select()
          .single()
        if (quizRow) {
          created.quizzes++
          await service.from('quiz_questions').insert(
            les.quiz.questions.map((q, i) => ({
              quiz_id: (quizRow as any).id,
              question_text: q.question,
              question_type: 'multiple_choice',
              options: JSON.stringify(
                (q.options || []).map((text, idx) => ({
                  text,
                  is_correct: idx === q.correctIndex,
                }))
              ),
              correct_answer: q.options?.[q.correctIndex] || '',
              order_index: i,
              points: 1,
            }))
          )
          const resources = [
            {
              id: crypto.randomUUID(),
              activity: 'quiz',
              title: les.quiz.title || 'Quiz',
              quizId: (quizRow as any).id,
              createdAt: new Date().toISOString(),
            },
          ]
          await service
            .from('lessons')
            .update({ resources })
            .eq('id', (lessonRow as any).id)
        }
      }
    }
  }

  if (generated.title) {
    await service
      .from('courses')
      .update({
        title: generated.title,
        description: generated.description || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId)
  }

  return NextResponse.json({ success: true, generated, created })
}
