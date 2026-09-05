// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'
import {
  getMandatoryActivities,
  isActivityRequired,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'

async function getSession() {
  const session = await createSupabaseServerClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return { session, user }
}

async function assertLessonLearnerAccess(
  db: any,
  lessonId: string,
  userId: string,
  role?: string | null
) {
  const courseId = await courseIdByLesson(db, lessonId)
  if (!courseId) return { ok: false as const, status: 404, error: 'Lesson not found' }

  if (await userCanManageCourse(db, courseId, userId, role as any)) {
    return { ok: true as const, courseId }
  }

  const { data: enrollment } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .limit(1)
    .maybeSingle()

  if (!enrollment) {
    return { ok: false as const, status: 403, error: 'Enroll in this course to track activities' }
  }
  return { ok: true as const, courseId }
}

async function loadLessonActivities(db: any, lessonId: string): Promise<LessonActivity[]> {
  const { data: lesson } = await db.from('lessons').select('resources').eq('id', lessonId).maybeSingle()
  return parseLessonActivities(lesson?.resources)
}

async function syncLessonActivityCompleted(
  db: any,
  userId: string,
  lessonId: string,
  activities: LessonActivity[],
  completedIds: Set<string>
) {
  const mandatory = activities.filter(isActivityRequired)
  const allDone =
    mandatory.length === 0 || mandatory.every((a) => completedIds.has(a.id))

  const { data: existing } = await db
    .from('lesson_progress')
    .select('id, activity_completed')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (existing) {
    if (Boolean(existing.activity_completed) === allDone) return allDone
    await db
      .from('lesson_progress')
      .update({
        activity_completed: allDone,
        activity_completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', existing.id)
  } else if (allDone) {
    const courseId = await courseIdByLesson(db, lessonId)
    await db.from('lesson_progress').insert({
      user_id: userId,
      lesson_id: lessonId,
      course_id: courseId,
      activity_completed: true,
      activity_completed_at: new Date().toISOString(),
      completed: false,
    })
  }
  return allDone
}

async function syncQuizPasses(
  db: any,
  userId: string,
  lessonId: string,
  activities: LessonActivity[]
) {
  const quizzes = activities.filter((a) => a.activity === 'quiz' && a.quizId)
  if (quizzes.length === 0) return

  const quizIds = quizzes.map((q) => q.quizId!)
  const { data: attempts } = await db
    .from('quiz_attempts')
    .select('quiz_id, passed')
    .eq('user_id', userId)
    .in('quiz_id', quizIds)
    .eq('passed', true)

  const passedQuizIds = new Set((attempts || []).map((a: any) => a.quiz_id))
  for (const quiz of quizzes) {
    if (!passedQuizIds.has(quiz.quizId)) continue
    await db.from('lesson_activity_progress').upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        activity_id: quiz.id,
        completed: true,
        completed_at: new Date().toISOString(),
        source: 'quiz_pass',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id,activity_id' }
    )
  }
}

/**
 * GET /api/lessons/[lessonId]/activity-progress
 * POST { activityId, action?: 'ack' | 'sync' }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params
    const { session, user } = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await tryCreateServiceClient()
    const db = admin || session
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const access = await assertLessonLearnerAccess(db, lessonId, user.id, profile?.role)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const activities = await loadLessonActivities(db, lessonId)
    await syncQuizPasses(db, user.id, lessonId, activities)

    const { data: rows } = await db
      .from('lesson_activity_progress')
      .select('activity_id, completed, completed_at, source')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)

    const progressById: Record<
      string,
      { completed: boolean; completed_at?: string | null; source?: string }
    > = {}
    for (const row of rows || []) {
      progressById[row.activity_id] = {
        completed: Boolean(row.completed),
        completed_at: row.completed_at,
        source: row.source,
      }
    }

    const completedIds = new Set(
      Object.entries(progressById)
        .filter(([, v]) => v.completed)
        .map(([id]) => id)
    )
    const mandatory = getMandatoryActivities(activities)
    const completedMandatory = mandatory.filter((a) => completedIds.has(a.id)).length
    const activityCompleted = await syncLessonActivityCompleted(
      db,
      user.id,
      lessonId,
      activities,
      completedIds
    )

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        title: a.title,
        activity: a.activity,
        required: isActivityRequired(a),
        quizId: a.quizId || null,
        completed: Boolean(progressById[a.id]?.completed),
        completed_at: progressById[a.id]?.completed_at || null,
        source: progressById[a.id]?.source || null,
      })),
      mandatoryTotal: mandatory.length,
      mandatoryCompleted: completedMandatory,
      activityCompleted,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load progress' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params
    const { session, user } = await getSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await tryCreateServiceClient()
    const db = admin || session
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const access = await assertLessonLearnerAccess(db, lessonId, user.id, profile?.role)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'ack'
    const activityId = typeof body.activityId === 'string' ? body.activityId : null

    const activities = await loadLessonActivities(db, lessonId)

    if (action === 'sync') {
      await syncQuizPasses(db, user.id, lessonId, activities)
    } else {
      if (!activityId) {
        return NextResponse.json({ error: 'activityId is required' }, { status: 400 })
      }
      const activity = activities.find((a) => a.id === activityId)
      if (!activity) {
        return NextResponse.json({ error: 'Activity not found on this lesson' }, { status: 404 })
      }
      if (activity.activity === 'quiz') {
        return NextResponse.json(
          { error: 'Quizzes complete automatically when you pass' },
          { status: 400 }
        )
      }

      const { error } = await db.from('lesson_activity_progress').upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          activity_id: activityId,
          completed: true,
          completed_at: new Date().toISOString(),
          source: 'ack',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id,activity_id' }
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Return refreshed state
    const url = new URL(request.url)
    const getReq = new NextRequest(url, { headers: request.headers })
    return GET(getReq, { params })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update progress' }, { status: 500 })
  }
}
