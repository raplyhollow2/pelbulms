// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { authorizeLessonManage } from '@/lib/authoring'
import { courseIdByLesson } from '@/lib/course-access'
import { notifyEnrolledStudents } from '@/lib/notify-enrolled'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

/**
 * GET /api/quizzes?lessonId=... -> list quizzes (with question count) for a lesson.
 */
export async function GET(request: NextRequest) {
  try {
    const rbac = await checkRBAC(request, [...TEACHER_ROLES])
    if (!rbac.hasAccess) {
      return NextResponse.json(
        { error: rbac.error || 'Access denied' },
        { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
      )
    }

    const lessonId = request.nextUrl.searchParams.get('lessonId')
    if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })

    const db = await getDbClient()
    const auth = await authorizeLessonManage(db, lessonId, rbac.userId!, rbac.userRole)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await db
      .from('quizzes')
      .select('*, quiz_questions(count)')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ quizzes: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list quizzes' }, { status: 500 })
  }
}

/**
 * POST /api/quizzes -> create a quiz on a lesson.
 */
export async function POST(request: NextRequest) {
  try {
    const rbac = await checkRBAC(request, [...TEACHER_ROLES])
    if (!rbac.hasAccess) {
      return NextResponse.json(
        { error: rbac.error || 'Access denied' },
        { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { lessonId, title, description, passingScore, maxAttempts, timeLimitMinutes, isPublished } =
      body || {}
    if (!lessonId || !title?.trim()) {
      return NextResponse.json({ error: 'lessonId and title are required' }, { status: 400 })
    }

    const db = await getDbClient()
    const auth = await authorizeLessonManage(db, lessonId, rbac.userId!, rbac.userRole)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await db
      .from('quizzes')
      .insert({
        lesson_id: lessonId,
        title: title.trim(),
        description: description || null,
        passing_score: Number.isFinite(passingScore) ? passingScore : 70,
        max_attempts: Number.isFinite(maxAttempts) ? maxAttempts : 3,
        time_limit_minutes: Number.isFinite(timeLimitMinutes) ? timeLimitMinutes : null,
        is_published: Boolean(isPublished),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const courseId = await courseIdByLesson(db, lessonId)
    if (courseId) {
      void notifyEnrolledStudents(db, {
        courseId,
        type: 'activity_update',
        title: 'New quiz added',
        message: `A quiz “${title.trim()}” was added to your course.`,
        actionUrl: `/learn/${courseId}/lesson/${lessonId}`,
      }).catch(() => {})
    }

    return NextResponse.json({ quiz: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create quiz' }, { status: 500 })
  }
}
