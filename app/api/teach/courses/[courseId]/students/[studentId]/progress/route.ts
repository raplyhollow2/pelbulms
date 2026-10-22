import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { getRequestUser } from '@/lib/request-user'
import type { UserRole } from '@/lib/rbac'

/**
 * GET /api/teach/courses/[courseId]/students/[studentId]/progress
 * Lesson progress + quiz attempts + certificate for course staff.
 * Uses service role so admins/superadmins see the same data as the course owner
 * (client RLS historically only allowed courses.instructor_id).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; studentId: string }> }
) {
  try {
    const { courseId, studentId } = await context.params
    if (!courseId || !studentId) {
      return NextResponse.json({ error: 'courseId and studentId are required' }, { status: 400 })
    }

    await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = ((profile as { role?: string } | null)?.role || undefined) as UserRole | undefined

    if (!(await userCanManageCourse(service, courseId, user.id, role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [{ data: modules }, { data: progressRows }, { data: certificate }] = await Promise.all([
      service
        .from('modules')
        .select('id')
        .eq('course_id', courseId),
      service
        .from('lesson_progress')
        .select(
          'id, lesson_id, course_id, user_id, completed, completed_at, time_spent_seconds, progress_percentage'
        )
        .eq('user_id', studentId)
        .eq('course_id', courseId),
      service
        .from('certificates')
        .select('*')
        .eq('user_id', studentId)
        .eq('course_id', courseId)
        .maybeSingle(),
    ])

    const moduleIds = ((modules || []) as { id: string }[]).map((m) => m.id)
    let lessons: { id: string; module_id: string; title: string; order_index: number | null }[] = []
    if (moduleIds.length) {
      const { data: lessonRows } = await service
        .from('lessons')
        .select('id, module_id, title, order_index')
        .in('module_id', moduleIds)
        .eq('is_published', true)
        .order('order_index', { ascending: true })
      lessons = (lessonRows || []) as typeof lessons
    }

    const lessonIds = lessons.map((l) => l.id)
    const quizByLesson: Record<string, string> = {}
    const attemptByLesson: Record<string, { score: number; passed: boolean }> = {}

    if (lessonIds.length) {
      const { data: quizzes } = await service
        .from('quizzes')
        .select('id, lesson_id')
        .in('lesson_id', lessonIds)

      const quizIds = ((quizzes || []) as { id: string; lesson_id: string }[]).map((q) => {
        quizByLesson[q.lesson_id] = q.id
        return q.id
      })

      if (quizIds.length) {
        const { data: attempts } = await service
          .from('quiz_attempts')
          .select('quiz_id, score, passed')
          .eq('user_id', studentId)
          .in('quiz_id', quizIds)

        const quizToLesson = new Map<string, string>()
        for (const [lessonId, quizId] of Object.entries(quizByLesson)) {
          quizToLesson.set(quizId, lessonId)
        }
        for (const a of (attempts || []) as { quiz_id: string; score: number; passed: boolean }[]) {
          const lessonId = quizToLesson.get(a.quiz_id)
          if (!lessonId) continue
          const prev = attemptByLesson[lessonId]
          if (!prev || a.score > prev.score) {
            attemptByLesson[lessonId] = { score: a.score, passed: a.passed }
          }
        }
      }
    }

    return NextResponse.json({
      progress: progressRows || [],
      lessons,
      quizByLesson,
      attemptByLesson,
      certificate: certificate || null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load progress'
    console.error('[teach/student-progress]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
