// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseInstructorByQuiz, canManageCourse } from '@/lib/authoring'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

async function authorize(request: NextRequest, quizId: string) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) return { ok: false as const, status: rbac.error?.includes('Unauthorized') ? 401 : 403, error: rbac.error || 'Access denied' }
  const service = await createServiceClient()
  const instructorId = await courseInstructorByQuiz(service, quizId)
  if (!instructorId) return { ok: false as const, status: 404, error: 'Quiz not found' }
  if (!canManageCourse(rbac.userRole, instructorId, rbac.userId!)) {
    return { ok: false as const, status: 403, error: 'You do not own this course' }
  }
  return { ok: true as const, service }
}

/** PATCH /api/quizzes/[quizId]/questions/[questionId] -> update a question. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const { quizId, questionId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const patch: Record<string, any> = {}
  if (typeof body.questionText === 'string') patch.question_text = body.questionText.trim()
  if (typeof body.questionType === 'string') patch.question_type = body.questionType
  if ('options' in body) patch.options = Array.isArray(body.options) ? JSON.stringify(body.options) : null
  if ('correctAnswer' in body) patch.correct_answer = body.correctAnswer != null ? String(body.correctAnswer) : null
  if ('explanation' in body) patch.explanation = body.explanation || null
  if (Number.isFinite(body.points)) patch.points = body.points
  if (Number.isFinite(body.orderIndex)) patch.order_index = body.orderIndex

  const { data, error } = await auth.service
    .from('quiz_questions')
    .update(patch)
    .eq('id', questionId)
    .eq('quiz_id', quizId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ question: data })
}

/** DELETE /api/quizzes/[quizId]/questions/[questionId]. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const { quizId, questionId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.service
    .from('quiz_questions')
    .delete()
    .eq('id', questionId)
    .eq('quiz_id', quizId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
