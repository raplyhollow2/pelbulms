// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { authorizeLessonManage } from '@/lib/authoring'
import { runJsonText } from '@/lib/ai/dispatch'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export const maxDuration = 300

type GeneratedQuiz = {
  title?: string
  questions: Array<{
    question: string
    options: string[]
    correctIndex: number
    explanation?: string
  }>
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const lessonId = body.lessonId as string | undefined
  const topic = String(body.topic || '').trim()
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const auth = await authorizeLessonManage(service, lessonId, rbac.userId!, rbac.userRole)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: lesson } = await service
    .from('lessons')
    .select('title, description, content')
    .eq('id', lessonId)
    .maybeSingle()

  try {
    const generated = await runJsonText<GeneratedQuiz>({
      feature: 'quiz',
      userId: rbac.userId,
      prompt: `Write a short multiple-choice knowledge check for Pelbu LMS (Bhutan).
Lesson title: ${(lesson as any)?.title || ''}
Lesson notes: ${String((lesson as any)?.description || (lesson as any)?.content || '').slice(0, 4000)}
Extra topic: ${topic || 'the lesson content'}

JSON:
{
  "title": string,
  "questions": [
    { "question": string, "options": [string, string, string, string], "correctIndex": 0, "explanation": string }
  ]
}
Create 4 questions. One correct option per question.`,
    })
    return NextResponse.json({ quiz: generated })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Quiz generation failed. A superadmin needs to configure AI.' },
      { status: e?.status || 500 }
    )
  }
}
