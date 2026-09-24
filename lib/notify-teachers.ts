/**
 * Notify course instructors when students enroll or complete.
 */

import { listCourseStaffIds } from '@/lib/course-access'
import { publicAppUrl, sendEmail } from '@/lib/email/send'

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

  const approveUrl = `${publicAppUrl()}${actionUrl}`
  const text = [
    `${studentName} requested to join “${courseTitle}”.`,
    '',
    `Review the request: ${approveUrl}`,
  ].join('\n')
  const html = `<p>${escapeHtml(studentName)} requested to join “${escapeHtml(courseTitle)}”.</p><p><a href="${approveUrl}">Review enrollment request</a></p>`

  for (const r of recipients || []) {
    const email = (r as any).email as string | null
    if (!email) continue
    const result = await sendEmail({
      to: email,
      subject: `Enrollment request: ${courseTitle}`,
      text,
      html,
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

  return insertNotification(service, {
    user_id: instructorId,
    type: 'student_completed',
    title: 'Student completed a course',
    message: `${studentName} completed “${courseTitle}”.`,
    action_url: `/teach/courses/${input.courseId}/students/${input.studentId}`,
    metadata: {
      course_id: input.courseId,
      student_id: input.studentId,
      event: 'completed',
    },
  })
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

  const gradeUrl = `${publicAppUrl()}${actionUrl}`
  const text = [message, '', `Grade it: ${gradeUrl}`].join('\n')
  const html = `<p>${escapeHtml(message)}</p><p><a href="${gradeUrl}">Grade now</a></p>`

  for (const r of recipients || []) {
    const email = (r as any).email as string | null
    if (!email) continue
    const result = await sendEmail({
      to: email,
      subject: `${title}: ${activityTitle}`,
      text,
      html,
    })
    if (!result.sent && result.error) {
      console.error('[notify-teachers] submission email failed:', result.error)
    }
  }

  return inserted
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
