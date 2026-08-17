import type { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/rbac'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'

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

export async function courseIdByQuiz(
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
  return courseIdByLesson(service, lessonId)
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

/** Owner, co-teacher, or staff. Prefer this for new routes. */
export async function canManageCourseId(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  courseId: string,
  userId: string,
  role?: UserRole
): Promise<boolean> {
  return userCanManageCourse(service, courseId, userId, role)
}

export async function authorizeLessonManage(
  service: Service,
  lessonId: string,
  userId: string,
  role?: UserRole
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const courseId = await courseIdByLesson(service, lessonId)
  if (!courseId) return { ok: false, status: 404, error: 'Lesson not found' }
  if (!(await userCanManageCourse(service, courseId, userId, role))) {
    return { ok: false, status: 403, error: 'You cannot manage this course' }
  }
  return { ok: true }
}

export async function authorizeQuizManage(
  service: Service,
  quizId: string,
  userId: string,
  role?: UserRole
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const courseId = await courseIdByQuiz(service, quizId)
  if (!courseId) return { ok: false, status: 404, error: 'Quiz not found' }
  if (!(await userCanManageCourse(service, courseId, userId, role))) {
    return { ok: false, status: 403, error: 'You cannot manage this course' }
  }
  return { ok: true }
}
