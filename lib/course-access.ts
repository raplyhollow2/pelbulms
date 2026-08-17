// @ts-nocheck - course_instructors not in generated Database types yet
import type { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/rbac'

type Service = Awaited<ReturnType<typeof createServiceClient>>

export type CourseStaffRole = 'owner' | 'co_teacher' | 'assistant'

/**
 * True if the user owns the course, is a co-facilitator, or is global staff.
 */
export async function userCanManageCourse(
  service: Service,
  courseId: string,
  userId: string,
  role?: UserRole
): Promise<boolean> {
  if (role === 'admin' || role === 'superadmin' || role === 'resource_person') {
    return true
  }

  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()

  if ((course as any)?.instructor_id === userId) return true

  const { data: staff } = await service
    .from('course_instructors')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()

  return Boolean(staff)
}

export async function courseIdByLesson(
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
  return (mod as any)?.course_id ?? null
}

export async function listCourseStaffIds(
  service: Service,
  courseId: string
): Promise<string[]> {
  const ids = new Set<string>()
  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  if ((course as any)?.instructor_id) ids.add((course as any).instructor_id)

  const { data: staff } = await service
    .from('course_instructors')
    .select('user_id')
    .eq('course_id', courseId)

  for (const row of staff || []) {
    if ((row as any).user_id) ids.add((row as any).user_id)
  }
  return [...ids]
}
