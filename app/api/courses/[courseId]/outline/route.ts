import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { userCanManageCourse } from '@/lib/course-access'
import {
  loadCourseInstitutions,
  userCanSeeCourseAudience,
} from '@/lib/course-institution-access'
import { canAccessTeaching, type UserRole } from '@/lib/roles'

/**
 * GET /api/courses/[courseId]/outline
 * Module and lesson titles for the public course page.
 * Includes unpublished lessons as upcoming, without content, video, or resources.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    if (!courseId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const service = await createServiceClient()
    const user = await getRequestUser(request)

    const { data: course } = await service
      .from('courses')
      .select('id, is_published, instructor_id')
      .eq('id', courseId)
      .maybeSingle()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    let role: string | null = user?.role || null
    let institutionId: string | null = null
    let enrolled = false
    if (user) {
      const { data: profile } = await service
        .from('profiles')
        .select('role, institution_id')
        .eq('id', user.id)
        .maybeSingle()
      role = (profile as { role?: string | null } | null)?.role || role
      institutionId = (profile as { institution_id?: string | null } | null)?.institution_id || null
      const { data: enrollment } = await service
        .from('enrollments')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()
      const status = (enrollment as { status?: string | null } | null)?.status
      enrolled = status === 'active' || status === 'completed' || status === 'pending'
    }

    const canManage = user
      ? await userCanManageCourse(service, courseId, user.id, (role || undefined) as UserRole | undefined)
      : false

    if ((course as { is_published?: boolean }).is_published !== true && !canManage) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const institutions = await loadCourseInstitutions(service as never, courseId)
    const allowed = userCanSeeCourseAudience({
      institutionIds: institutions.map((institution) => institution.id),
      userInstitutionId: institutionId,
      role,
      isInstructorOrStaff: canManage || canAccessTeaching(role as UserRole | null),
      isEnrolled: enrolled,
    })
    if (!allowed) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const { data: modules } = await service
      .from('modules')
      .select('id, title, description, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const moduleRows = (modules || []) as Array<{
      id: string
      title: string
      description: string | null
      order_index: number
    }>
    const moduleIds = moduleRows.map((row) => row.id)

    let lessons: Array<{
      id: string
      module_id: string
      title: string
      duration_minutes: number | null
      order_index: number | null
      is_published: boolean | null
      is_free: boolean | null
      is_preview: boolean | null
    }> = []

    if (moduleIds.length > 0) {
      const { data } = await service
        .from('lessons')
        .select('id, module_id, title, duration_minutes, order_index, is_published, is_free, is_preview')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true })
      lessons = (data || []) as typeof lessons
    }

    return NextResponse.json({
      modules: moduleRows.map((moduleRow) => ({
        id: moduleRow.id,
        title: moduleRow.title,
        description: moduleRow.description,
        order_index: moduleRow.order_index,
        lessons: lessons
          .filter((lesson) => lesson.module_id === moduleRow.id)
          .map((lesson) => {
            const published = lesson.is_published === true
            return {
              id: lesson.id,
              title: lesson.title,
              duration_minutes: lesson.duration_minutes,
              order_index: lesson.order_index,
              is_published: published,
              is_free: published && lesson.is_free === true,
              is_preview: published && (lesson.is_free === true || lesson.is_preview === true),
            }
          }),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load course outline'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
