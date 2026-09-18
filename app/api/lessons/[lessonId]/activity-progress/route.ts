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
import {
  isAssessableActivity,
  requiresLearnerInput,
  submissionStatusForActivity,
  validateActivityResponse,
  type ActivityResponsePayload,
} from '@/lib/activity-responses'

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

async function buildProgressPayload(
  db: any,
  userId: string,
  lessonId: string,
  activities: LessonActivity[]
) {
  await syncQuizPasses(db, userId, lessonId, activities)

  const { data: rows } = await db
    .from('lesson_activity_progress')
    .select(
      'activity_id, completed, completed_at, source, response, user_id, status, grade, max_grade, feedback, return_file_url, return_file_name, return_url, graded_at, submitted_at'
    )
    .eq('lesson_id', lessonId)

  const myRows = (rows || []).filter((r: any) => r.user_id === userId)
  const progressById: Record<
    string,
    {
      completed: boolean
      completed_at?: string | null
      source?: string
      response?: ActivityResponsePayload | null
      status?: string | null
      grade?: number | null
      max_grade?: number | null
      feedback?: string | null
      return_file_url?: string | null
      return_file_name?: string | null
      return_url?: string | null
      graded_at?: string | null
      submitted_at?: string | null
    }
  > = {}
  for (const row of myRows) {
    progressById[row.activity_id] = {
      completed: Boolean(row.completed),
      completed_at: row.completed_at,
      source: row.source,
      response: row.response || null,
      status: row.status || null,
      grade: row.grade ?? null,
      max_grade: row.max_grade ?? null,
      feedback: row.feedback || null,
      return_file_url: row.return_file_url || null,
      return_file_name: row.return_file_name || null,
      return_url: row.return_url || null,
      graded_at: row.graded_at || null,
      submitted_at: row.submitted_at || null,
    }
  }

  // Aggregate chat messages for chat activities (all enrolled learners)
  const chatMessagesByActivity: Record<
    string,
    { userId: string; message: string; at?: string }[]
  > = {}
  for (const row of rows || []) {
    if (row.source !== 'chat' || !row.response?.message) continue
    if (!chatMessagesByActivity[row.activity_id]) chatMessagesByActivity[row.activity_id] = []
    chatMessagesByActivity[row.activity_id].push({
      userId: row.user_id,
      message: row.response.message,
      at: row.completed_at || row.updated_at,
    })
  }

  // Choice tallies for transparency
  const choiceTalliesByActivity: Record<string, Record<string, number>> = {}
  for (const row of rows || []) {
    if (row.source !== 'choice' || !row.response?.choice) continue
    if (!choiceTalliesByActivity[row.activity_id]) choiceTalliesByActivity[row.activity_id] = {}
    const key = row.response.choice
    choiceTalliesByActivity[row.activity_id][key] =
      (choiceTalliesByActivity[row.activity_id][key] || 0) + 1
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
    userId,
    lessonId,
    activities,
    completedIds
  )

  return {
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      activity: a.activity,
      required: isActivityRequired(a),
      quizId: a.quizId || null,
      choices: a.choices || null,
      completed: Boolean(progressById[a.id]?.completed),
      completed_at: progressById[a.id]?.completed_at || null,
      source: progressById[a.id]?.source || null,
      response: progressById[a.id]?.response || null,
      status: progressById[a.id]?.status || null,
      grade: progressById[a.id]?.grade ?? null,
      max_grade: progressById[a.id]?.max_grade ?? null,
      feedback: progressById[a.id]?.feedback || null,
      return_file_url: progressById[a.id]?.return_file_url || null,
      return_file_name: progressById[a.id]?.return_file_name || null,
      return_url: progressById[a.id]?.return_url || null,
      graded_at: progressById[a.id]?.graded_at || null,
      submitted_at: progressById[a.id]?.submitted_at || null,
      chatMessages: chatMessagesByActivity[a.id] || [],
      choiceTallies: choiceTalliesByActivity[a.id] || null,
    })),
    mandatoryTotal: mandatory.length,
    mandatoryCompleted: completedMandatory,
    activityCompleted,
  }
}

/**
 * GET /api/lessons/[lessonId]/activity-progress
 * POST { activityId, action?: 'ack' | 'sync' | 'submit', response?: object }
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
    const payload = await buildProgressPayload(db, user.id, lessonId, activities)
    return NextResponse.json(payload)
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
    const responsePayload = (body.response || null) as ActivityResponsePayload | null

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

      // Prefer explicit submit; also accept ack with response for input types
      const needsInput = requiresLearnerInput(activity.activity)
      if (needsInput || action === 'submit') {
        const validated = validateActivityResponse(activity, responsePayload)
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 })
        }

        if (
          activity.activity === 'assignment' &&
          activity.allowSubmissions === false &&
          validated.response.fileUrl
        ) {
          return NextResponse.json(
            { error: 'File submissions are not allowed for this assignment' },
            { status: 400 }
          )
        }

        const now = new Date()
        const nowIso = now.toISOString()
        const assessable = isAssessableActivity(activity)
        const status = assessable
          ? submissionStatusForActivity(activity, now)
          : 'submitted'
        const maxGrade =
          typeof activity.maxGrade === 'number' && activity.maxGrade > 0
            ? activity.maxGrade
            : null

        const { error } = await db.from('lesson_activity_progress').upsert(
          {
            user_id: user.id,
            lesson_id: lessonId,
            activity_id: activityId,
            completed: true,
            completed_at: nowIso,
            submitted_at: nowIso,
            source: validated.source,
            response: validated.response,
            status,
            max_grade: maxGrade,
            grade: null,
            feedback: null,
            return_file_url: null,
            return_file_name: null,
            return_url: null,
            graded_at: null,
            graded_by: null,
            updated_at: nowIso,
          },
          { onConflict: 'user_id,lesson_id,activity_id' }
        )
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      } else {
        // Plain ack for link/file/page style activities
        if (requiresLearnerInput(activity.activity)) {
          return NextResponse.json(
            { error: 'This activity requires a submission' },
            { status: 400 }
          )
        }
        const nowIso = new Date().toISOString()
        const { error } = await db.from('lesson_activity_progress').upsert(
          {
            user_id: user.id,
            lesson_id: lessonId,
            activity_id: activityId,
            completed: true,
            completed_at: nowIso,
            submitted_at: nowIso,
            source: 'ack',
            response: responsePayload || null,
            status: 'submitted',
            updated_at: nowIso,
          },
          { onConflict: 'user_id,lesson_id,activity_id' }
        )
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    const payload = await buildProgressPayload(db, user.id, lessonId, activities)
    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update progress' }, { status: 500 })
  }
}
