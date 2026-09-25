import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdmin, canAccessTeaching } from '@/lib/roles'
import { currentAssessableActivityKeys } from '@/lib/activity-responses'
import { getRequestUser } from '@/lib/request-user'

/**
 * GET /api/teach/grading-summary
 * Pending gradable submissions for every course the caller can grade.
 * Admin and superadmin see every course. Loaded once for the teacher dashboard.
 */
export async function GET(request: Request) {
  try {
    const auth = await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = (await createServiceClient()) as any
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = (profile as any)?.role as string | undefined
    if (!canAccessTeaching(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let courses: { id: string; title: string }[] = []
    if (canAccessAdmin(role)) {
      const { data } = await service.from('courses').select('id, title')
      courses = (data || []) as { id: string; title: string }[]
    } else {
      const [{ data: owned }, { data: staff }] = await Promise.all([
        service.from('courses').select('id, title').eq('instructor_id', user.id),
        service.from('course_instructors').select('course_id').eq('user_id', user.id),
      ])
      const ids = new Set<string>()
      for (const c of owned || []) ids.add((c as any).id)
      for (const s of staff || []) ids.add((s as any).course_id)
      const extra = [...ids].filter((id) => !(owned || []).some((c: any) => c.id === id))
      courses = ((owned || []) as { id: string; title: string }[]).slice()
      if (extra.length) {
        const { data: more } = await service.from('courses').select('id, title').in('id', extra)
        courses.push(...((more || []) as { id: string; title: string }[]))
      }
    }

    if (courses.length === 0) {
      return NextResponse.json({ counts: {}, backlog: [] })
    }

    const courseIds = courses.map((c) => c.id)
    const { data: modules } = await service
      .from('modules')
      .select('id, course_id')
      .in('course_id', courseIds)
    const moduleList = (modules || []) as { id: string; course_id: string }[]
    const courseByModule = new Map(moduleList.map((m) => [m.id, m.course_id]))
    const moduleIds = moduleList.map((m) => m.id)
    if (moduleIds.length === 0) {
      return NextResponse.json({ counts: {}, backlog: [] })
    }

    const { data: lessons } = await service
      .from('lessons')
      .select('id, module_id, resources')
      .in('module_id', moduleIds)
    const lessonList = (lessons || []) as { id: string; module_id: string; resources?: unknown }[]
    const courseByLesson = new Map(
      lessonList.map((l) => [l.id, courseByModule.get(l.module_id) || ''])
    )
    const assessableKeys = currentAssessableActivityKeys(lessonList)
    const lessonIds = lessonList.map((l) => l.id)
    if (lessonIds.length === 0) {
      return NextResponse.json({ counts: {}, backlog: [] })
    }

    const counts: Record<string, number> = {}
    const chunk = 200
    for (let i = 0; i < lessonIds.length; i += chunk) {
      const slice = lessonIds.slice(i, i + chunk)
      const { data: progress } = await service
        .from('lesson_activity_progress')
        .select('lesson_id, activity_id, status, completed, source')
        .in('lesson_id', slice)
        .in('source', ['submission', 'response'])
        .limit(5000)
      for (const row of progress || []) {
        const lessonId = (row as any).lesson_id as string
        const activityId = (row as any).activity_id as string
        if (!assessableKeys.has(`${lessonId}:${activityId}`)) continue
        const submitted = (row as any).completed || (row as any).status
        const status = (row as any).status as string | null
        if (!submitted) continue
        if (status === 'graded' || status === 'returned') continue
        const courseId = courseByLesson.get(lessonId)
        if (!courseId) continue
        counts[courseId] = (counts[courseId] || 0) + 1
      }
    }

    const titleById = new Map(courses.map((c) => [c.id, c.title]))
    const backlog = Object.entries(counts)
      .filter(([, pendingCount]) => pendingCount > 0)
      .map(([courseId, pendingCount]) => ({
        courseId,
        title: titleById.get(courseId) || 'Course',
        pendingCount,
      }))
      .sort((a, b) => b.pendingCount - a.pendingCount)

    return NextResponse.json({ counts, backlog })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load grading summary' }, { status: 500 })
  }
}
