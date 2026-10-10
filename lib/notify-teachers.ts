/**
 * Notify course instructors when students enroll or complete.
 */

import { listCourseStaffIds } from '@/lib/course-access'
import { sendTemplatedEmail } from '@/lib/email/templated'

async function insertNotification(
  service: any,
  row: {
    user_id: string
    type: string
    title: string
    message: string
    action_url: string
    metadata?: Record<string, unknown>
  }
) {
  const { error } = await service.from('notifications').insert({
    ...row,
    is_read: false,
    metadata: row.metadata || {},
  })
  if (error) {
    console.error('[notify-teachers] insert failed:', error)
    return false
  }
  return true
}

async function insertNotifications(
  service: any,
  rows: Array<{
    user_id: string
    type: string
    title: string
    message: string
    action_url: string
    metadata?: Record<string, unknown>
  }>
) {
  if (rows.length === 0) return false
  const { error } = await service.from('notifications').insert(
    rows.map((row) => ({
      ...row,
      is_read: false,
      metadata: row.metadata || {},
    }))
  )
  if (error) {
    console.error('[notify-teachers] bulk insert failed:', error)
    return false
  }
  return true
}

async function resolveCourseInstructor(
  service: any,
  courseId: string
): Promise<{ instructorId: string | null; courseTitle: string }> {
  const { data: course } = await service
    .from('courses')
    .select('id, title, instructor_id')
    .eq('id', courseId)
    .maybeSingle()

  return {
    instructorId: course?.instructor_id || null,
    courseTitle: course?.title || 'your course',
  }
}

async function resolveStudentName(service: any, studentId: string): Promise<string> {
  const { data: profile } = await service
    .from('profiles')
    .select('full_name, email')
    .eq('id', studentId)
    .maybeSingle()

  return profile?.full_name || profile?.email || 'A student'
}

async function resolvePendingRecipientIds(
  service: any,
  instructorId: string | null,
  studentId: string,
  courseId: string
): Promise<string[]> {
  const ids = new Set<string>()
  if (instructorId && instructorId !== studentId) ids.add(instructorId)

  try {
    const staffIds = await listCourseStaffIds(service, courseId)
    for (const id of staffIds) {
      if (id && id !== studentId) ids.add(id)
    }
  } catch (err) {
    console.error('[notify-teachers] course staff lookup failed:', err)
  }

  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'superadmin'])

  for (const p of admins || []) {
    if (p.id && p.id !== studentId) ids.add(p.id)
  }

  return [...ids]
}

export async function notifyTeacherOfEnrollment(
  service: any,
  input: { courseId: string; studentId: string; pending?: boolean }
): Promise<boolean> {
  const { instructorId, courseTitle } = await resolveCourseInstructor(service, input.courseId)
  const studentName = await resolveStudentName(service, input.studentId)
  const pending = Boolean(input.pending)
  const actionUrl = `/teach/courses/${input.courseId}/students`

  if (!pending) {
    if (!instructorId || instructorId === input.studentId) return false
    return insertNotification(service, {
      user_id: instructorId,
      type: 'student_enrolled',
      title: 'New student enrolled',
      message: `${studentName} enrolled in “${courseTitle}”.`,
      action_url: actionUrl,
      metadata: {
        course_id: input.courseId,
        student_id: input.studentId,
        event: 'enrolled',
      },
    })
  }

  const recipientIds = await resolvePendingRecipientIds(
    service,
    instructorId,
    input.studentId,
    input.courseId
  )
  if (recipientIds.length === 0) return false

  const title = 'Enrollment request'
  const message = `${studentName} requested to join “${courseTitle}”. Approve or reject on the students page.`
  const metadata = {
    course_id: input.courseId,
    student_id: input.studentId,
    event: 'enrollment_request',
  }

  const inserted = await insertNotifications(
    service,
    recipientIds.map((user_id) => ({
      user_id,
      type: 'enrollment_request',
      title,
      message,
      action_url: actionUrl,
      metadata,
    }))
  )

  const { data: recipients } = await service
    .from('profiles')
    .select('id, email')
    .in('id', recipientIds)

  for (const r of recipients || []) {
    const email = (r as any).email as string | null
    const userId = (r as any).id as string | null
    if (!email) continue
    const result = await sendTemplatedEmail({
      templateKey: 'enrollment.requested',
      to: email,
      userId,
      respectCoursePreferences: false,
      vars: {
        student_name: studentName,
        course_title: courseTitle,
        action_url: actionUrl,
      },
    })
    if (!result.sent && result.error) {
      console.error('[notify-teachers] email failed:', result.error)
    }
  }

  return inserted
}

export async function notifyTeacherOfCompletion(
  service: any,
  input: { courseId: string; studentId: string }
): Promise<boolean> {
  const { instructorId, courseTitle } = await resolveCourseInstructor(service, input.courseId)
  if (!instructorId || instructorId === input.studentId) return false

  const studentName = await resolveStudentName(service, input.studentId)

  const actionUrl = `/teach/courses/${input.courseId}/students/${input.studentId}`
  const inserted = await insertNotification(service, {
    user_id: instructorId,
    type: 'student_completed',
    title: 'Student completed a course',
    message: `${studentName} completed “${courseTitle}”.`,
    action_url: actionUrl,
    metadata: {
      course_id: input.courseId,
      student_id: input.studentId,
      event: 'completed',
    },
  })

  const { data: instructor } = await service
    .from('profiles')
    .select('email')
    .eq('id', instructorId)
    .maybeSingle()
  const email = (instructor as { email?: string | null } | null)?.email
  if (email) {
    const result = await sendTemplatedEmail({
      templateKey: 'course.completed',
      to: email,
      userId: instructorId,
      respectCoursePreferences: false,
      vars: {
        learner_name: studentName,
        course_title: courseTitle,
        action_url: actionUrl,
      },
    })
    if (!result.sent && result.error) {
      console.error('[notify-teachers] completion email failed:', result.error)
    }
  }

  return inserted
}

/**
 * Alert the course creator and every superadmin when a student submits
 * gradable work. Resubmits alert again.
 */
export async function notifyStaffOfSubmission(
  service: any,
  input: {
    courseId: string
    lessonId: string
    activityId: string
    activityTitle: string
    studentId: string
    resubmission: boolean
  }
): Promise<boolean> {
  const { data: course } = await service
    .from('courses')
    .select('instructor_id, title')
    .eq('id', input.courseId)
    .maybeSingle()

  const courseTitle = (course as any)?.title || 'a course'
  const ids = new Set<string>()
  const creatorId = (course as any)?.instructor_id as string | null
  if (creatorId && creatorId !== input.studentId) ids.add(creatorId)

  const { data: supers } = await service.from('profiles').select('id').eq('role', 'superadmin')
  for (const row of supers || []) {
    const id = (row as any).id as string | undefined
    if (id && id !== input.studentId) ids.add(id)
  }

  const recipientIds = [...ids]
  if (recipientIds.length === 0) return false

  const studentName = await resolveStudentName(service, input.studentId)
  const verb = input.resubmission ? 'resubmitted' : 'submitted'
  const title = input.resubmission ? 'Work resubmitted' : 'Work to grade'
  const activityTitle = input.activityTitle || 'an activity'
  const message = `${studentName} ${verb} “${activityTitle}” in “${courseTitle}”.`
  const actionUrl = `/teach/courses/${input.courseId}/grading?lessonId=${encodeURIComponent(input.lessonId)}&activityId=${encodeURIComponent(input.activityId)}`
  const metadata = {
    course_id: input.courseId,
    lesson_id: input.lessonId,
    activity_id: input.activityId,
    student_id: input.studentId,
    student_name: studentName,
    course_title: courseTitle,
    activity_title: activityTitle,
    event: input.resubmission ? 'resubmission' : 'submission',
  }

  const inserted = await insertNotifications(
    service,
    recipientIds.map((user_id) => ({
      user_id,
      type: 'submission_pending',
      title,
      message,
      action_url: actionUrl,
      metadata,
    }))
  )

  const { data: recipients } = await service
    .from('profiles')
    .select('id, email')
    .in('id', recipientIds)

  for (const r of recipients || []) {
    const email = (r as any).email as string | null
    const userId = (r as any).id as string | null
    if (!email) continue
    const result = await sendTemplatedEmail({
      templateKey: 'submission.received',
      to: email,
      userId,
      respectCoursePreferences: false,
      vars: {
        learner_name: studentName,
        verb,
        activity_title: activityTitle,
        course_title: courseTitle,
        title,
        action_url: actionUrl,
      },
    })
    if (!result.sent && result.error) {
      console.error('[notify-teachers] submission email failed:', result.error)
    }
  }

  return inserted
}

const GRADED_SUBMISSION_STATUSES = new Set(['graded', 'returned'])

function submissionNoticeKey(studentId: string, lessonId: string, activityId: string) {
  return `${studentId}:${lessonId}:${activityId}`
}

/**
 * Mark unread submission_pending notices as read once that work is graded
 * or returned. Scope to one inbox with userId, or to one submission so every
 * staff recipient is cleared after a grade is saved.
 */
export async function dismissGradedSubmissionNotifications(
  service: any,
  scope: {
    userId?: string
    studentId?: string
    lessonId?: string
    activityId?: string
  }
): Promise<void> {
  const targeted = Boolean(scope.studentId && scope.lessonId && scope.activityId)

  let query = service
    .from('notifications')
    .select('id, metadata')
    .eq('type', 'submission_pending')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(200)

  if (scope.userId) query = query.eq('user_id', scope.userId)
  if (targeted) {
    query = query.contains('metadata', {
      student_id: scope.studentId,
      lesson_id: scope.lessonId,
      activity_id: scope.activityId,
    })
  }

  const { data: notices, error } = await query
  if (error) {
    console.error('[notify-teachers] pending notice lookup failed:', error)
    return
  }
  if (!notices?.length) return

  let resolvedIds: string[] = []
  if (targeted) {
    resolvedIds = notices.map((notice: { id: string }) => notice.id)
  } else {
    const keys = (notices as Array<{ id: string; metadata?: Record<string, unknown> | null }>)
      .map((notice) => {
        const meta = notice.metadata || {}
        const studentId = typeof meta.student_id === 'string' ? meta.student_id : ''
        const lessonId = typeof meta.lesson_id === 'string' ? meta.lesson_id : ''
        const activityId = typeof meta.activity_id === 'string' ? meta.activity_id : ''
        if (!studentId || !lessonId || !activityId) return null
        return { id: notice.id, studentId, lessonId, activityId }
      })
      .filter((key): key is { id: string; studentId: string; lessonId: string; activityId: string } =>
        Boolean(key)
      )

    if (!keys.length) return

    const { data: progress, error: progressError } = await service
      .from('lesson_activity_progress')
      .select('user_id, lesson_id, activity_id, status')
      .in('user_id', [...new Set(keys.map((key) => key.studentId))])
      .in('activity_id', [...new Set(keys.map((key) => key.activityId))])

    if (progressError) {
      console.error('[notify-teachers] progress lookup failed:', progressError)
      return
    }

    const statusByKey = new Map<string, string | null>()
    for (const row of progress || []) {
      statusByKey.set(
        submissionNoticeKey(row.user_id, row.lesson_id, row.activity_id),
        row.status ?? null
      )
    }

    resolvedIds = keys
      .filter((key) => {
        const status = statusByKey.get(
          submissionNoticeKey(key.studentId, key.lessonId, key.activityId)
        )
        if (status === undefined) return true
        return GRADED_SUBMISSION_STATUSES.has(status)
      })
      .map((key) => key.id)
  }

  if (!resolvedIds.length) return

  const { error: updateError } = await service
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in('id', resolvedIds)

  if (updateError) {
    console.error('[notify-teachers] dismiss pending notices failed:', updateError)
  }
}
