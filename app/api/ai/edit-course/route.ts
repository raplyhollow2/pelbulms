// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'
import { runJsonText, runText } from '@/lib/ai/dispatch'
import { parseLessonBlocks, newBlockId, sanitizeHtml, type LessonBlock } from '@/lib/lesson-blocks'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const lessonId = body.lessonId as string | undefined
  const courseIdIn = body.courseId as string | undefined
  const instruction = String(body.instruction || '').trim()
  if (!instruction) return NextResponse.json({ error: 'instruction is required' }, { status: 400 })

  const service = await createServiceClient()
  let courseId = courseIdIn
  if (lessonId && !courseId) courseId = await courseIdByLesson(service, lessonId)
  if (!courseId) return NextResponse.json({ error: 'courseId or lessonId is required' }, { status: 400 })
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: course } = await service.from('courses').select('title, description, metadata').eq('id', courseId).maybeSingle()

  if (lessonId) {
    const { data: lesson } = await service
      .from('lessons')
      .select('id, title, description, content')
      .eq('id', lessonId)
      .single()
    const blocks = parseLessonBlocks((lesson as any)?.content)
    const lower = instruction.toLowerCase()

    try {
      if (lessonId && (lower.includes('add a quiz') || lower.includes('add quiz') || lower.includes('short quiz'))) {
        const generated = await runJsonText<{
          title?: string
          questions: Array<{ question: string; options: string[]; correctIndex: number; explanation?: string }>
        }>({
          feature: 'course-edit',
          userId: rbac.userId,
          prompt: `Write a 4-question multiple-choice quiz for lesson “${(lesson as any)?.title}”.
Context: ${String((lesson as any)?.description || '').slice(0, 2000)}
JSON: { "title": string, "questions": [{ "question": string, "options": [string, string, string, string], "correctIndex": 0, "explanation": string }] }`,
        })
        const { data: quizRow } = await service
          .from('quizzes')
          .insert({
            lesson_id: lessonId,
            title: generated.title || 'Lesson quiz',
            passing_score: 70,
            max_attempts: 3,
            is_published: true,
          })
          .select('id')
          .single()
        if (quizRow) {
          await service.from('quiz_questions').insert(
            (generated.questions || []).map((q, i) => ({
              quiz_id: quizRow.id,
              question_text: q.question,
              question_type: 'multiple_choice',
              options: JSON.stringify(
                (q.options || []).map((text, idx) => ({
                  text,
                  is_correct: idx === q.correctIndex,
                }))
              ),
              correct_answer: q.options?.[q.correctIndex] || '',
              explanation: q.explanation || null,
              order_index: i,
              points: 1,
            }))
          )
          const next = [...blocks, { id: newBlockId(), type: 'quiz', quizId: quizRow.id }]
          await service
            .from('lessons')
            .update({ content: next, updated_at: new Date().toISOString() })
            .eq('id', lessonId)
          return NextResponse.json({ success: true, reply: 'Added a knowledge check to this page.', blocks: next })
        }
      }

      const updated = await runJsonText<{ blocks?: LessonBlock[]; html?: string; reply: string }>({
        feature: 'course-edit',
        userId: rbac.userId,
        prompt: `You edit an online lesson in Pelbu LMS.
Course: ${(course as any)?.title}
Lesson: ${(lesson as any)?.title}
Current blocks JSON: ${JSON.stringify(blocks).slice(0, 12000)}
Teacher instruction: ${instruction}

Return JSON:
{
  "reply": "short confirmation of what you changed",
  "blocks": [ ...updated lesson blocks using types text|accordion|flipcards|carousel|hotspot|image|youtube|video... ]
}
Keep existing quiz/assignment/scenario blocks (same ids and types) unless asked to remove them.
For text blocks use HTML. Give every block an id.`,
      })
      let nextBlocks = Array.isArray(updated.blocks) ? updated.blocks : blocks
      nextBlocks = nextBlocks.map((b: any) => ({
        ...b,
        id: b.id || newBlockId(),
        html: b.html ? sanitizeHtml(b.html) : b.html,
      }))
      await service
        .from('lessons')
        .update({ content: nextBlocks, updated_at: new Date().toISOString() })
        .eq('id', lessonId)
      return NextResponse.json({ success: true, reply: updated.reply, blocks: nextBlocks })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Edit failed' }, { status: e?.status || 500 })
    }
  }

  try {
    const reply = (
      await runText({
        feature: 'course-edit',
        userId: rbac.userId,
        prompt: `Course “${(course as any)?.title}”: ${(course as any)?.description || ''}
Teacher asked: ${instruction}
Give a concise actionable reply. If they asked to rename the course, propose a title.`,
      })
    ).text
    return NextResponse.json({ success: true, reply })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Edit failed' }, { status: e?.status || 500 })
  }
}
