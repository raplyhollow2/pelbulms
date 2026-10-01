import { NextRequest, NextResponse } from 'next/server'
import { courseIdByQuiz } from '@/lib/authoring'
import { gradeQuiz, type GradedQuestion } from '@/lib/quiz-grade'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/quizzes/[quizId]/attempts
 * Grades on the server and stores the attempt. A client-supplied score is ignored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quizId } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof body.answers !== 'object' || body.answers === null) {
    return NextResponse.json({ error: 'answers are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const courseId = await courseIdByQuiz(service, quizId)
  if (!courseId) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  const { data: enrollment } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = (enrollment as { status?: string } | null)?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return NextResponse.json({ error: 'Enroll in this course before taking the quiz' }, { status: 403 })
  }

  const { data: course } = await service
    .from('courses')
    .select('is_published')
    .eq('id', courseId)
    .maybeSingle()
  if ((course as { is_published?: boolean } | null)?.is_published !== true) {
    return NextResponse.json({ error: 'This course is no longer available' }, { status: 403 })
  }

  const { data: quiz } = await service.from('quizzes').select('*').eq('id', quizId).maybeSingle()
  if (!quiz || (quiz as { is_published?: boolean }).is_published === false) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  }

  const maxAttempts = Math.max(1, Number((quiz as { max_attempts?: number }).max_attempts) || 3)
  const { count } = await service
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('quiz_id', quizId)
  const used = count || 0
  if (used >= maxAttempts) {
    return NextResponse.json({ error: 'No attempts remaining', attemptsUsed: used, maxAttempts }, { status: 403 })
  }

  const { data: questionRows, error: questionError } = await service
    .from('quiz_questions')
    .select('id, question_type, options, correct_answer, explanation, points')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 400 })

  const questions = (questionRows || []) as unknown as GradedQuestion[]
  const passingScore = Number((quiz as { passing_score?: number }).passing_score) || 70
  const graded = gradeQuiz(questions, body.answers as Record<string, unknown>, passingScore)
  const timeSpent = Math.max(0, Math.round(Number(body.timeSpentSeconds) || 0))

  const { data: attempt, error } = await service
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      started_at: typeof body.startedAt === 'string' ? body.startedAt : new Date().toISOString(),
      completed_at: new Date().toISOString(),
      score: graded.score,
      passed: graded.passed,
      time_spent_seconds: timeSpent,
      answers: body.answers,
      feedback: {
        correctCount: graded.correctCount,
        totalQuestions: questions.length,
        earnedPoints: graded.earnedPoints,
        totalPoints: graded.totalPoints,
        results: graded.results,
      },
    })
    .select()
    .single()

  if (error || !attempt) {
    return NextResponse.json({ error: error?.message || 'Could not store the attempt' }, { status: 400 })
  }

  const attemptsUsed = used + 1
  return NextResponse.json({
    attempt,
    passed: graded.passed,
    attemptsUsed,
    maxAttempts,
    attemptsExhausted: !graded.passed && attemptsUsed >= maxAttempts,
  })
}
