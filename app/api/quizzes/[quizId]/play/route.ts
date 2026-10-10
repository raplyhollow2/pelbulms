import { NextRequest, NextResponse } from 'next/server'
import { courseIdByQuiz } from '@/lib/authoring'
import { userCanManageCourse } from '@/lib/course-access'
import { lessonIsOpenForLearner } from '@/lib/module-live'
import { sanitizeQuestionForLearner } from '@/lib/quiz-grade'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/quizzes/[quizId]/play
 * Learners receive questions without answer keys. Course staff receive the full rows
 * so lesson preview can still score locally.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quizId } = await params
  const service = await createServiceClient()
  const courseId = await courseIdByQuiz(service, quizId)
  if (!courseId) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  const { data: quiz, error } = await service.from('quizzes').select('*').eq('id', quizId).maybeSingle()
  if (error || !quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  const staff = await userCanManageCourse(service, courseId, user.id, user.role || undefined)
  if (!staff) {
    const { data: enrollment } = await service
      .from('enrollments')
      .select('status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    const status = (enrollment as { status?: string } | null)?.status
    const enrolled = status === 'active' || status === 'completed'
    const { data: lesson } = await service
      .from('lessons')
      .select('is_published, is_free, is_preview')
      .eq('id', (quiz as { lesson_id: string }).lesson_id)
      .maybeSingle()
    const { data: course } = await service
      .from('courses')
      .select('is_published')
      .eq('id', courseId)
      .maybeSingle()
    const freePreview =
      (course as { is_published?: boolean } | null)?.is_published === true &&
      (lesson as { is_published?: boolean } | null)?.is_published === true &&
      ((lesson as { is_free?: boolean; is_preview?: boolean } | null)?.is_free === true ||
        (lesson as { is_preview?: boolean } | null)?.is_preview === true)
    const publishedQuiz = (quiz as { is_published?: boolean }).is_published !== false
    const lessonOpen = await lessonIsOpenForLearner(service, (quiz as { lesson_id: string }).lesson_id, user.id)
    if ((!enrolled && !freePreview) || !publishedQuiz || !lessonOpen) {
      return NextResponse.json({ error: 'You do not have access to this quiz' }, { status: 403 })
    }
  }

  const { data: questions, error: questionError } = await service
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 400 })

  const rows = (questions || []) as Record<string, unknown>[]
  return NextResponse.json({
    quiz,
    questions: staff ? rows : rows.map((row) => sanitizeQuestionForLearner(row)),
  })
}
