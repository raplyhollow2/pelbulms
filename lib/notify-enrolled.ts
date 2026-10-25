/**
 * Notify enrolled students about course events (announcements, etc.).
 */

import { sendTemplatedEmail } from '@/lib/email/templated'

const NOTIFICATION_CHUNK = 500
const PROFILE_PAGE = 1000

type Recipient = {
  id: string
  email?: string | null
  full_name?: string | null
}

async function insertNotificationChunks(service: any, rows: Record<string, unknown>[]) {
  let inserted = 0
  for (let index = 0; index < rows.length; index += NOTIFICATION_CHUNK) {
    const chunk = rows.slice(index, index + NOTIFICATION_CHUNK)
    const { error } = await service.from('notifications').insert(chunk)
    if (error) {
      console.error('[notify-enrolled] insert failed:', error)
      continue
    }
    inserted += chunk.length
  }
  return inserted
}

async function emailRecipients(
  recipients: Recipient[],
  input: {
    emailTemplate: string
    title: string
    message: string
    courseTitle: string
    actionUrl: string
  }
) {
  for (const profile of recipients) {
    const email = profile.email
    if (!email || !profile.id) continue
    const result = await sendTemplatedEmail({
      templateKey: input.emailTemplate,
      to: email,
      userId: profile.id,
      writtenAnnouncement: true,
      vars: {
        learner_name: profile.full_name || 'there',
        course_title: input.courseTitle,
        title: input.title,
        message: input.message,
        action_url: input.actionUrl,
      },
    })
    if (!result.sent && result.error) {
      console.error('[notify-enrolled] templated email failed:', result.error)
    }
  }
}

export async function notifyEnrolledStudents(
  service: any,
  input: {
    courseId: string
    title: string
    message: string
    actionUrl?: string
    type?: string
    emailTemplate?: string | null
  }
): Promise<number> {
  const { data: enrollments, error } = await service
    .from('enrollments')
    .select('user_id')
    .eq('course_id', input.courseId)
    .eq('status', 'active')

  if (error || !enrollments?.length) {
    if (error) console.error('[notify-enrolled] enrollments query failed:', error)
    return 0
  }

  const actionUrl = input.actionUrl || `/learn/${input.courseId}`
  const rows = enrollments.map((e: { user_id: string }) => ({
    user_id: e.user_id,
    type: input.type || 'announcement',
    title: input.title,
    message: input.message,
    action_url: actionUrl,
    is_read: false,
    metadata: { course_id: input.courseId },
  }))

  const inserted = await insertNotificationChunks(service, rows)
  if (!inserted) return 0

  if (input.emailTemplate) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, email, full_name')
      .in(
        'id',
        enrollments.map((row: { user_id: string }) => row.user_id)
      )
    const { data: course } = await service.from('courses').select('title').eq('id', input.courseId).maybeSingle()
    const courseTitle = (course as { title?: string } | null)?.title || 'your course'
    await emailRecipients((profiles || []) as Recipient[], {
      emailTemplate: input.emailTemplate,
      title: input.title,
      message: input.message,
      courseTitle,
      actionUrl,
    })
  }

  return inserted
}

/** In-app notice and optional email for every student profile. */
export async function notifyAllStudents(
  service: any,
  input: {
    title: string
    message: string
    actionUrl?: string
    emailTemplate?: string | null
  }
): Promise<number> {
  const students: Recipient[] = []
  for (let from = 0; ; from += PROFILE_PAGE) {
    const { data, error } = await service
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'student')
      .order('id', { ascending: true })
      .range(from, from + PROFILE_PAGE - 1)
    if (error) {
      console.error('[notify-enrolled] student query failed:', error)
      break
    }
    const page = (data || []) as Recipient[]
    students.push(...page.filter((row) => row.id))
    if (page.length < PROFILE_PAGE) break
  }

  if (!students.length) return 0

  const actionUrl = input.actionUrl || '/announcements'
  const rows = students.map((student) => ({
    user_id: student.id,
    type: 'announcement',
    title: input.title.slice(0, 500),
    message: input.message,
    action_url: actionUrl,
    is_read: false,
    metadata: { global: true },
  }))

  const inserted = await insertNotificationChunks(service, rows)
  if (input.emailTemplate) {
    await emailRecipients(students, {
      emailTemplate: input.emailTemplate,
      title: input.title,
      message: input.message,
      courseTitle: 'All courses',
      actionUrl,
    })
  }
  return inserted
}

export async function notifyStudentOfEnrollmentDecision(
  service: any,
  input: {
    courseId: string
    courseTitle: string
    studentId: string
    approved: boolean
  }
): Promise<boolean> {
  const approved = input.approved
  const title = approved ? 'Enrollment approved' : 'Enrollment not approved'
  const message = approved
    ? `You are now enrolled in “${input.courseTitle}”. Start learning anytime.`
    : `Your request to join “${input.courseTitle}” was not approved by the course creator.`
  const actionUrl = approved ? `/learn/${input.courseId}` : `/courses/${input.courseId}`

  const { error } = await service.from('notifications').insert({
    user_id: input.studentId,
    type: approved ? 'enrollment_approved' : 'enrollment_rejected',
    title,
    message,
    action_url: actionUrl,
    is_read: false,
    metadata: {
      course_id: input.courseId,
      event: approved ? 'enrollment_approved' : 'enrollment_rejected',
    },
  })
  if (error) {
    console.error('[notify-enrolled] decision notify failed:', error)
  }

  const { data: profile } = await service
    .from('profiles')
    .select('email, full_name')
    .eq('id', input.studentId)
    .maybeSingle()

  const email = (profile as { email?: string | null } | null)?.email
  if (email) {
    const result = await sendTemplatedEmail({
      templateKey: approved ? 'enrollment.approved' : 'enrollment.rejected',
      to: email,
      userId: input.studentId,
      respectCoursePreferences: false,
      vars: {
        learner_name: (profile as { full_name?: string | null } | null)?.full_name || 'there',
        course_title: input.courseTitle,
        action_url: actionUrl,
      },
    })
    if (!result.sent && result.error) {
      console.error('[notify-enrolled] decision email failed:', result.error)
    }
  }

  return !error
}
