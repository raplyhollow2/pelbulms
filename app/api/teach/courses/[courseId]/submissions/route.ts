// @ts-nocheck - lesson_activity_progress not in generated Database types yet
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import {
  isAssessableActivity,
  summarizeResponse,
  type ActivityResponsePayload,
} from '@/lib/activity-responses'
import { parseLessonActivities, type LessonActivity } from '@/lib/lesson-activities'

type AssessableActivityMeta = {
  lessonId: string
  lessonTitle: string
  moduleId: string
  moduleTitle: string
  activity: LessonActivity
}

function collectAssessableActivities(
  lessons: { id: string; title: string; module_id: string; resources: unknown }[],
  modulesById: Map<string, { id: string; title: string }>
): AssessableActivityMeta[] {
  const out: AssessableActivityMeta[] = []
  for (const lesson of lessons) {
    const activities = parseLessonActivities(lesson.resources)
    const mod = modulesById.get(lesson.module_id)
    for (const activity of activities) {
      if (!isAssessableActivity(activity)) continue
      out.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleId: lesson.module_id,
        moduleTitle: mod?.title || 'Module',
        activity,
      })
    }
  }
  return out
}

function buildSubmissionRow(
  en: any,
  meta: AssessableActivityMeta,
  row: any | undefined
) {
  const profile = en.profiles || {}
  const response = (row?.response || null) as ActivityResponsePayload | null
  return {
    progressId: row?.id || null,
    userId: en.user_id,
    studentName: profile.full_name || profile.email || 'Student',
    studentEmail: profile.email || null,
    avatarUrl: profile.avatar_url || null,
    enrollmentStatus: en.status,
    status: row?.status || (row?.completed ? 'submitted' : null),
    grade: row?.grade ?? null,
    maxGrade: row?.max_grade ?? meta.activity.maxGrade ?? null,
    feedback: row?.feedback || null,
    returnFileUrl: row?.return_file_url || null,
    returnFileName: row?.return_file_name || null,
    returnUrl: row?.return_url || null,
    gradedAt: row?.graded_at || null,
    gradedBy: row?.graded_by || null,
    submittedAt: row?.submitted_at || row?.completed_at || null,
    completed: Boolean(row?.completed),
    source: row?.source || null,
    response,
    summary: summarizeResponse(meta.activity.activity, response),
    fileUrl: response?.fileUrl || null,
    fileName: response?.fileName || null,
  }
}

/**
 * GET /api/teach/courses/[courseId]/submissions
 * Optional query: lessonId, activityId, studentId
 * Include submission rows when lessonId+activityId or studentId is provided, or includeAll=1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = (await createServiceClient()) as any
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const canManage = await userCanManageCourse(
      service,
      courseId,
      user.id,
      (profile as any)?.role
    )
    if (!canManage) {
      return NextResponse.json({ error: 'Only course staff can view submissions' }, { status: 403 })
    }

    const sp = new URL(request.url).searchParams
    const filterLessonId = sp.get('lessonId')
    const filterActivityId = sp.get('activityId')
    const filterStudentId = sp.get('studentId')
    const includeAll = sp.get('includeAll') === '1'
    const includeSubmissions =
      includeAll || Boolean(filterStudentId) || Boolean(filterLessonId && filterActivityId)

    const { data: modules } = await service
      .from('modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const moduleList = (modules || []) as any[]
    const modulesById = new Map(moduleList.map((m) => [m.id, m]))
    const moduleIds = moduleList.map((m) => m.id)

    let lessons: any[] = []
    if (moduleIds.length > 0) {
      let lessonQuery = service
        .from('lessons')
        .select('id, title, module_id, resources, order_index')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true })
      if (filterLessonId) lessonQuery = lessonQuery.eq('id', filterLessonId)
      const { data } = await lessonQuery
      lessons = data || []
    }

    let assessable = collectAssessableActivities(lessons, modulesById)
    if (filterActivityId) {
      assessable = assessable.filter((a) => a.activity.id === filterActivityId)
    }

    const lessonIds = [...new Set(assessable.map((a) => a.lessonId))]
    const activityIds = [...new Set(assessable.map((a) => a.activity.id))]

    const { data: enrollments } = await service
      .from('enrollments')
      .select('user_id, status, profiles(id, full_name, email, avatar_url)')
      .eq('course_id', courseId)
      .in('status', ['active', 'completed', 'pending'])

    let enrollmentList = (enrollments || []) as any[]
    if (filterStudentId) {
      enrollmentList = enrollmentList.filter((e) => e.user_id === filterStudentId)
    }

    let progressRows: any[] = []
    if (lessonIds.length > 0 && activityIds.length > 0) {
      let progressQuery = service
        .from('lesson_activity_progress')
        .select(
          'id, user_id, lesson_id, activity_id, completed, completed_at, source, response, status, grade, max_grade, feedback, return_file_url, return_file_name, return_url, graded_at, graded_by, submitted_at, updated_at'
        )
        .in('lesson_id', lessonIds)
        .in('activity_id', activityIds)
      if (filterStudentId) {
        progressQuery = progressQuery.eq('user_id', filterStudentId)
      }
      const { data } = await progressQuery
      progressRows = data || []
    }

    const progressKey = (userId: string, lessonId: string, activityId: string) =>
      `${userId}:${lessonId}:${activityId}`
    const progressByKey = new Map<string, any>()
    for (const row of progressRows) {
      progressByKey.set(progressKey(row.user_id, row.lesson_id, row.activity_id), row)
    }

    const activities = assessable.map((meta) => {
      const submissions = enrollmentList.map((en) =>
        buildSubmissionRow(
          en,
          meta,
          progressByKey.get(progressKey(en.user_id, meta.lessonId, meta.activity.id))
        )
      )
      const submitted = submissions.filter((s) => s.completed || s.status)
      const pending = submitted.filter(
        (s) => s.status !== 'graded' && s.status !== 'returned'
      ).length
      const graded = submitted.filter(
        (s) => s.status === 'graded' || s.status === 'returned'
      ).length

      return {
        lessonId: meta.lessonId,
        lessonTitle: meta.lessonTitle,
        moduleId: meta.moduleId,
        moduleTitle: meta.moduleTitle,
        activityId: meta.activity.id,
        activityTitle: meta.activity.title,
        activityType: meta.activity.activity,
        dueDate: meta.activity.dueDate || null,
        maxGrade: meta.activity.maxGrade ?? null,
        passGrade: meta.activity.passGrade ?? null,
        pendingCount: pending,
        gradedCount: graded,
        submittedCount: submitted.length,
        rosterCount: enrollmentList.length,
        ...(includeSubmissions ? { submissions } : {}),
      }
    })

    const totals = {
      assessableActivities: activities.length,
      pendingGrading: activities.reduce((s, a) => s + (a.pendingCount || 0), 0),
      graded: activities.reduce((s, a) => s + (a.gradedCount || 0), 0),
      submitted: activities.reduce((s, a) => s + (a.submittedCount || 0), 0),
    }

    return NextResponse.json({ courseId, totals, activities })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load submissions' },
      { status: 500 }
    )
  }
}
