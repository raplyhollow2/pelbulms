/**
 * Notify enrolled students about course events (announcements, etc.).
 */

import { publicAppUrl, sendEmail } from '@/lib/email/send'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function notifyEnrolledStudents(
  service: any,
  input: {
    courseId: string
    title: string
    message: string
    actionUrl?: string
    type?: string
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

  const rows = enrollments.map((e: any) => ({
    user_id: e.user_id,
    type: input.type || 'announcement',
    title: input.title,
    message: input.message,
    action_url: input.actionUrl || `/learn/${input.courseId}`,
    is_read: false,
    metadata: { course_id: input.courseId },
  }))

  const { error: insertError } = await service.from('notifications').insert(rows)
  if (insertError) {
    console.error('[notify-enrolled] insert failed:', insertError)
    return 0
  }
  return rows.length
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
    .select('email')
    .eq('id', input.studentId)
    .maybeSingle()

  const email = (profile as { email?: string | null } | null)?.email
  if (email) {
    const link = `${publicAppUrl()}${actionUrl}`
    const result = await sendEmail({
      to: email,
      subject: approved
        ? `Enrollment approved: ${input.courseTitle}`
        : `Enrollment not approved: ${input.courseTitle}`,
      text: `${message}\n\n${approved ? 'Open the course' : 'View the course'}: ${link}`,
      html: `<p>${escapeHtml(message)}</p><p><a href="${link}">${approved ? 'Start learning' : 'View course'}</a></p>`,
    })
    if (!result.sent && result.error) {
      console.error('[notify-enrolled] decision email failed:', result.error)
    }
  }

  return !error
}
