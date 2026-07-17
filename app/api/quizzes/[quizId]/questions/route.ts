// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseInstructorByQuiz, canManageCourse } from '@/lib/authoring'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const
const QUESTION_TYPES = ['multiple_choice', 'true_false', 'short_answer', 'essay']

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

/** GET /api/quizzes/[quizId]/questions -> ordered questions. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.service
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ questions: data || [] })
}

/**
 * POST /api/quizzes/[quizId]/questions -> add a question.
 * Body: { questionText, questionType?, options?: string[], correctAnswer, explanation?, points?, orderIndex? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { questionText, questionType, options, correctAnswer, explanation, points, orderIndex } = body || {}
  if (!questionText?.trim()) return NextResponse.json({ error: 'questionText is required' }, { status: 400 })

  const type = QUESTION_TYPES.includes(questionType) ? questionType : 'multiple_choice'
  if ((type === 'multiple_choice') && (!Array.isArray(options) || options.length < 2)) {
    return NextResponse.json({ error: 'Multiple-choice questions need at least 2 options' }, { status: 400 })
  }

  const { data, error } = await auth.service
    .from('quiz_questions')
    .insert({
      quiz_id: quizId,
      question_text: questionText.trim(),
      question_type: type,
      options: Array.isArray(options) ? JSON.stringify(options) : null,
      correct_answer: correctAnswer != null ? String(correctAnswer) : null,
      explanation: explanation || null,
      points: Number.isFinite(points) ? points : 1,
      order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ question: data })
}

/**
 * PUT /api/quizzes/[quizId]/questions -> reorder questions.
 * Body: { order: string[] } (question ids in the desired order)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const order: string[] = Array.isArray(body?.order) ? body.order : []
  if (!order.length) return NextResponse.json({ error: 'order array is required' }, { status: 400 })

  await Promise.all(
    order.map((id, index) =>
      auth.service.from('quiz_questions').update({ order_index: index }).eq('id', id).eq('quiz_id', quizId)
    )
  )

  return NextResponse.json({ success: true })
}
