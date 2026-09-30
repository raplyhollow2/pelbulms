// @ts-nocheck - course_instructors not in generated Database types yet
import type { createServiceClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/rbac'
import { scopedCourseIdsForAdmin } from '@/lib/admin-org-scope'

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
  if (role === 'superadmin' || role === 'resource_person') {
    return true
  }

  if (role === 'admin') {
    const scoped = await scopedCourseIdsForAdmin(service, userId, role)
    if (!scoped) return true
    return scoped.includes(courseId)
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

/** Learners may open a course only while it is published. */
export async function courseIsOpenToLearners(
  service: Service,
  courseId: string
): Promise<boolean> {
  const { data } = await service
    .from('courses')
    .select('is_published')
    .eq('id', courseId)
    .maybeSingle()
  return (data as { is_published?: boolean | null } | null)?.is_published === true
}

/**
 * Staff may use a draft. Enrolled learners may use a course only while it is published.
 */
export async function assertLearnerCourseOpen(
  service: Service,
  courseId: string,
  userId: string,
  role: UserRole | null | undefined,
  enrollError: string
): Promise<{ ok: true } | { ok: false; status: 403; error: string }> {
  if (await userCanManageCourse(service, courseId, userId, role || undefined)) {
    return { ok: true }
  }

  const { data: enrollment } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  const status = (enrollment as { status?: string } | null)?.status
  if (!enrollment || (status !== 'active' && status !== 'completed')) {
    return { ok: false, status: 403, error: enrollError }
  }
  if (!(await courseIsOpenToLearners(service, courseId))) {
    return { ok: false, status: 403, error: 'This course is no longer available.' }
  }
  return { ok: true }
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
