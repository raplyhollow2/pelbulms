import type { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/rbac'

type Service = Awaited<ReturnType<typeof createServiceClient>>

/**
 * Resolve the instructor (owner) of the course that a lesson belongs to.
 * Walks lessons -> modules -> courses with explicit queries (no FK-embed
 * assumptions).
 */
export async function courseInstructorByLesson(
  service: Service,
  lessonId: string
): Promise<string | null> {
  const { data: lesson } = await service
    .from('lessons')
    .select('module_id')
    .eq('id', lessonId)
    .maybeSingle()
  const moduleId = (lesson as any)?.module_id
  if (!moduleId) return null

  const { data: mod } = await service
    .from('modules')
    .select('course_id')
    .eq('id', moduleId)
    .maybeSingle()
  const courseId = (mod as any)?.course_id
  if (!courseId) return null

  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  return (course as any)?.instructor_id ?? null
}

/** Resolve the instructor of the course a quiz belongs to. */
export async function courseInstructorByQuiz(
  service: Service,
  quizId: string
): Promise<string | null> {
  const { data: quiz } = await service
    .from('quizzes')
    .select('lesson_id')
    .eq('id', quizId)
    .maybeSingle()
  const lessonId = (quiz as any)?.lesson_id
  if (!lessonId) return null
  return courseInstructorByLesson(service, lessonId)
}

/**
 * A user may manage authoring resources if they are an admin/superadmin, or if
 * they are the instructor that owns the course.
 */
export function canManageCourse(
  role: UserRole | undefined,
  instructorId: string | null,
  userId: string
): boolean {
  if (role === 'admin' || role === 'superadmin' || role === 'resource_person') return true
  return !!instructorId && instructorId === userId
}
