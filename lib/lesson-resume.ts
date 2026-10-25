// @ts-nocheck — lesson_resume_reminders and notifications are not in generated Database types.
import { sendTemplatedEmail } from '@/lib/email/templated'
import { tryCreateServiceClient } from '@/lib/supabase/server'

const REMINDER_TYPE = 'lesson_incomplete'
const DAY_MS = 24 * 60 * 60 * 1000

type Service = NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>

export function lessonResumePath(courseId: string, lessonId: string) {
  return `/learn/${courseId}/lesson/${lessonId}`
}

async function serviceOrNull() {
  return tryCreateServiceClient()
}

export async function cancelLessonResume(
  service: Service,
  userId: string,
  lessonId: string
) {
  await service
    .from('lesson_resume_reminders')
    .delete()
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)

  await service
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('type', REMINDER_TYPE)
    .eq('is_read', false)
    .filter('metadata->>lesson_id', 'eq', lessonId)
}

async function upsertOpenReminder(
  service: Service,
  input: {
    userId: string
    lessonId: string
    courseId: string
    lessonTitle: string
    percent: number
  }
) {
  const actionUrl = lessonResumePath(input.courseId, input.lessonId)
  const title = `Finish ${input.lessonTitle}`.slice(0, 500)
  const message = `You left this lesson ${input.percent}% complete. Continue where you stopped.`
  const metadata = {
    lesson_id: input.lessonId,
    course_id: input.courseId,
    progress_percentage: input.percent,
  }

  const { data: existing } = await service
    .from('notifications')
    .select('id')
    .eq('user_id', input.userId)
    .eq('type', REMINDER_TYPE)
    .eq('is_read', false)
    .filter('metadata->>lesson_id', 'eq', input.lessonId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await service
      .from('notifications')
      .update({ title, message, action_url: actionUrl, metadata })
      .eq('id', existing.id)
  } else {
    await service.from('notifications').insert({
      user_id: input.userId,
      type: REMINDER_TYPE,
      title,
      message,
      action_url: actionUrl,
      is_read: false,
      metadata,
    })
  }

  const now = new Date()
  await service.from('lesson_resume_reminders').upsert(
    {
      user_id: input.userId,
      lesson_id: input.lessonId,
      course_id: input.courseId,
      progress_percentage: input.percent,
      remind_at: new Date(now.getTime() + DAY_MS).toISOString(),
      emailed_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,lesson_id' }
  )
}

export async function recordLessonLeave(input: {
  userId: string
  lessonId: string
  courseId: string
  percent: number
  positionSeconds: number
  leaving: boolean
  finished: boolean
}) {
  const service = await serviceOrNull()
  if (!service) return { ok: false as const, error: 'Progress could not be saved' }

  const { data: lesson } = await service
    .from('lessons')
    .select('id, title')
    .eq('id', input.lessonId)
    .maybeSingle()
  if (!lesson) return { ok: false as const, status: 404, error: 'Lesson not found' }

  if (input.finished) {
    await cancelLessonResume(service, input.userId, input.lessonId)
    return { ok: true as const, percent: input.percent }
  }

  const { data: existing } = await service
    .from('lesson_progress')
    .select('id, completed, progress_percentage, last_position_seconds')
    .eq('user_id', input.userId)
    .eq('lesson_id', input.lessonId)
    .maybeSingle()

  if (existing?.completed) {
    await cancelLessonResume(service, input.userId, input.lessonId)
    return { ok: true as const, percent: 100 }
  }

  const storedPercent = Math.max(0, Math.min(100, Number(existing?.progress_percentage) || 0))
  const percent = Math.max(storedPercent, input.percent)
  const positionSeconds =
    input.percent >= storedPercent
      ? Math.max(0, Math.round(input.positionSeconds))
      : Math.max(0, Number(existing?.last_position_seconds) || 0)
  const now = new Date().toISOString()

  if (existing?.id) {
    const { error } = await service
      .from('lesson_progress')
      .update({
        course_id: input.courseId,
        progress_percentage: percent,
        last_position_seconds: positionSeconds,
        last_accessed_at: now,
      })
      .eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await service.from('lesson_progress').insert({
      user_id: input.userId,
      lesson_id: input.lessonId,
      course_id: input.courseId,
      completed: false,
      progress_percentage: percent,
      last_position_seconds: positionSeconds,
      last_accessed_at: now,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  if (input.leaving && percent >= 1 && percent <= 99) {
    await upsertOpenReminder(service, {
      userId: input.userId,
      lessonId: input.lessonId,
      courseId: input.courseId,
      lessonTitle: (lesson as { title?: string }).title || 'this lesson',
      percent,
    })
  } else if (percent >= 100 || percent < 1) {
    await service
      .from('lesson_resume_reminders')
      .delete()
      .eq('user_id', input.userId)
      .eq('lesson_id', input.lessonId)
  }

  return { ok: true as const, percent }
}

export async function sendDueLessonReminders() {
  const service = await serviceOrNull()
  if (!service) return { sent: 0, cleared: 0, failed: 0 }

  const now = new Date().toISOString()
  const { data: due, error } = await service
    .from('lesson_resume_reminders')
    .select('id, user_id, lesson_id, course_id, progress_percentage')
    .is('emailed_at', null)
    .lte('remind_at', now)
    .limit(100)

  if (error || !due?.length) return { sent: 0, cleared: 0, failed: error ? 1 : 0 }

  let sent = 0
  let cleared = 0
  let failed = 0

  for (const row of due as Array<{
    id: string
    user_id: string
    lesson_id: string
    course_id: string
    progress_percentage: number
  }>) {
    const { data: progress } = await service
      .from('lesson_progress')
      .select('completed, progress_percentage')
      .eq('user_id', row.user_id)
      .eq('lesson_id', row.lesson_id)
      .maybeSingle()

    const percent = Math.max(
      0,
      Math.min(100, Number(progress?.progress_percentage ?? row.progress_percentage) || 0)
    )
    if (progress?.completed || percent < 1 || percent >= 100) {
      await service.from('lesson_resume_reminders').delete().eq('id', row.id)
      cleared += 1
      continue
    }

    const [{ data: lesson }, { data: course }, { data: profile }] = await Promise.all([
      service.from('lessons').select('title').eq('id', row.lesson_id).maybeSingle(),
      service.from('courses').select('title').eq('id', row.course_id).maybeSingle(),
      service.from('profiles').select('email, full_name').eq('id', row.user_id).maybeSingle(),
    ])

    const email = (profile as { email?: string | null } | null)?.email
    if (!email) {
      await service
        .from('lesson_resume_reminders')
        .update({ emailed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id)
      cleared += 1
      continue
    }

    const result = await sendTemplatedEmail({
      templateKey: 'lesson.incomplete',
      to: email,
      userId: row.user_id,
      vars: {
        learner_name: (profile as { full_name?: string | null }).full_name || 'there',
        lesson_title: (lesson as { title?: string } | null)?.title || 'your lesson',
        course_title: (course as { title?: string } | null)?.title || 'your course',
        progress_percentage: String(percent),
        action_url: lessonResumePath(row.course_id, row.lesson_id),
      },
    })

    if (!result.sent && !result.skipped) {
      failed += 1
      continue
    }

    await service
      .from('lesson_resume_reminders')
      .update({
        progress_percentage: percent,
        emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (result.sent) sent += 1
    else cleared += 1
  }

  return { sent, cleared, failed }
}
