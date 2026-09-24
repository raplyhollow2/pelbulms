import {
  activityGateState,
  activitySatisfiesCompletion,
  type ActivityCompletionSnapshot,
  type CompletionBlocker,
} from '@/lib/activity-responses'
import { courseIdByLesson } from '@/lib/course-access'
import {
  isActivityRequired,
  parseLessonActivities,
  type LessonActivity,
} from '@/lib/lesson-activities'
import { mergeGateSettings } from '@/lib/progression-gates'

/** Same watch threshold the lesson player uses before auto-completing. */
export const VIDEO_COMPLETE_PERCENT = 90

type Db = any

type LessonRow = {
  id: string
  title?: string | null
  module_id?: string | null
  resources?: unknown
  video_url?: string | null
  is_published?: boolean | null
  metadata?: unknown
}

type LessonProgressRow = {
  id: string
  lesson_id: string
  completed?: boolean | null
  activity_completed?: boolean | null
  progress_percentage?: number | null
}

function snapshotFromRow(row: any): ActivityCompletionSnapshot {
  return {
    completed: Boolean(row?.completed),
    status: row?.status || null,
    grade: row?.grade ?? null,
    source: row?.source || null,
  }
}

export function mandatoryBlockersForLesson(
  lesson: { id?: string; title?: string | null },
  activities: LessonActivity[],
  progressByActivity: Map<string, ActivityCompletionSnapshot>
): CompletionBlocker[] {
  const blockers: CompletionBlocker[] = []
  for (const activity of activities) {
    if (!isActivityRequired(activity)) continue
    const progress = progressByActivity.get(activity.id) || null
    if (activitySatisfiesCompletion(activity, progress)) continue
    const state = activityGateState(activity, progress)
    blockers.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title || 'Lesson',
      activityId: activity.id,
      title: activity.title || 'Activity',
      state: state === 'satisfied' ? 'incomplete' : state,
      grade: progress?.grade ?? null,
      passGrade: activity.passGrade ?? null,
      maxGrade: activity.maxGrade ?? null,
    })
  }
  return blockers
}

async function writeLessonProgress(
  db: Db,
  row: LessonProgressRow | undefined,
  userId: string,
  lessonId: string,
  courseId: string,
  patch: {
    completed?: boolean
    activityCompleted: boolean
  }
) {
  const now = new Date().toISOString()
  const next: Record<string, unknown> = {
    activity_completed: patch.activityCompleted,
    activity_completed_at: patch.activityCompleted ? now : null,
    last_accessed_at: now,
  }
  if (typeof patch.completed === 'boolean') {
    next.completed = patch.completed
    next.completed_at = patch.completed ? now : null
    next.is_completed = patch.completed
  }

  if (row?.id) {
    let { error } = await db.from('lesson_progress').update(next).eq('id', row.id)
    if (error && String(error.message || '').toLowerCase().includes('is_completed')) {
      delete next.is_completed
      const retry = await db.from('lesson_progress').update(next).eq('id', row.id)
      error = retry.error
    }
    if (error) throw new Error(error.message)
    return
  }

  const insert: Record<string, unknown> = {
    user_id: userId,
    lesson_id: lessonId,
    course_id: courseId,
    completed: patch.completed === true,
    completed_at: patch.completed === true ? now : null,
    activity_completed: patch.activityCompleted,
    activity_completed_at: patch.activityCompleted ? now : null,
    is_completed: patch.completed === true,
  }
  let { error } = await db.from('lesson_progress').insert(insert)
  if (error && String(error.message || '').toLowerCase().includes('is_completed')) {
    delete insert.is_completed
    const retry = await db.from('lesson_progress').insert(insert)
    error = retry.error
  }
  if (error) throw new Error(error.message)
}

/**
 * Recompute activity satisfaction for every published lesson.
 * Clears lesson completion when a mandatory activity is not satisfied.
 * Auto-completes only `autoCompleteLessonId` when its video threshold is already met.
 */
export async function reconcileCourseCompletion(
  db: Db,
  userId: string,
  courseId: string,
  opts?: { autoCompleteLessonId?: string | null }
): Promise<{ blockers: CompletionBlocker[] }> {
  const { data: modules } = await db
    .from('modules')
    .select('id, metadata')
    .eq('course_id', courseId)

  const moduleList = (modules || []) as { id: string; metadata?: unknown }[]
  const moduleIds = moduleList.map((m) => m.id)
  if (moduleIds.length === 0) return { blockers: [] }

  const { data: lessons } = await db
    .from('lessons')
    .select('id, title, module_id, resources, video_url, is_published, metadata')
    .in('module_id', moduleIds)

  const published = ((lessons || []) as LessonRow[]).filter((l) => l.is_published === true)
  const lessonIds = published.map((l) => l.id)
  if (lessonIds.length === 0) return { blockers: [] }

  const [{ data: activityRows }, { data: lessonRows }] = await Promise.all([
    db
      .from('lesson_activity_progress')
      .select('lesson_id, activity_id, completed, status, grade, source')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds),
    db
      .from('lesson_progress')
      .select('id, lesson_id, completed, activity_completed, progress_percentage')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds),
  ])

  const progressByLesson = new Map<string, Map<string, ActivityCompletionSnapshot>>()
  for (const row of activityRows || []) {
    const lessonId = row.lesson_id as string
    if (!progressByLesson.has(lessonId)) progressByLesson.set(lessonId, new Map())
    progressByLesson.get(lessonId)!.set(row.activity_id as string, snapshotFromRow(row))
  }

  const lessonProgressById = new Map<string, LessonProgressRow>()
  for (const row of (lessonRows || []) as LessonProgressRow[]) {
    lessonProgressById.set(row.lesson_id, row)
  }

  const moduleById = new Map(moduleList.map((m) => [m.id, m]))
  const blockers: CompletionBlocker[] = []

  for (const lesson of published) {
    const activities = parseLessonActivities(lesson.resources)
    const progress = progressByLesson.get(lesson.id) || new Map()
    const lessonBlockers = mandatoryBlockersForLesson(lesson, activities, progress)
    blockers.push(...lessonBlockers)

    const allSatisfied = lessonBlockers.length === 0
    const existing = lessonProgressById.get(lesson.id)
    const settings = mergeGateSettings(
      moduleById.get(lesson.module_id || '')?.metadata,
      lesson.metadata
    )
    const videoOk =
      !lesson.video_url || (existing?.progress_percentage ?? 0) >= VIDEO_COMPLETE_PERCENT
    const mayAutoComplete =
      opts?.autoCompleteLessonId === lesson.id &&
      allSatisfied &&
      settings.completionMode === 'auto' &&
      videoOk

    let completedPatch: boolean | undefined
    if (!allSatisfied && existing?.completed) {
      completedPatch = false
    } else if (mayAutoComplete && !existing?.completed) {
      completedPatch = true
    }

    const activityFlag = Boolean(existing?.activity_completed)
    if (!existing) {
      if (!allSatisfied && completedPatch !== true) continue
      await writeLessonProgress(db, undefined, userId, lesson.id, courseId, {
        activityCompleted: allSatisfied,
        ...(completedPatch === true ? { completed: true } : {}),
      })
      continue
    }
    if (activityFlag === allSatisfied && completedPatch === undefined) continue

    await writeLessonProgress(db, existing, userId, lesson.id, courseId, {
      activityCompleted: allSatisfied,
      completed: completedPatch,
    })
  }

  return { blockers }
}

export async function reconcileLessonCourseCompletion(
  db: Db,
  userId: string,
  lessonId: string
): Promise<{ blockers: CompletionBlocker[]; courseId: string | null }> {
  const courseId = await courseIdByLesson(db, lessonId)
  if (!courseId) return { blockers: [], courseId: null }
  const result = await reconcileCourseCompletion(db, userId, courseId, {
    autoCompleteLessonId: lessonId,
  })
  return { ...result, courseId }
}
