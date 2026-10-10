/**
 * Notify enrolled students about course events (announcements, etc.).
 */

import { sendTemplatedEmail } from '@/lib/email/templated'

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
    for (const profile of profiles || []) {
      const email = (profile as { email?: string | null }).email
      const userId = (profile as { id?: string }).id
      if (!email || !userId) continue
      const result = await sendTemplatedEmail({
        templateKey: input.emailTemplate,
        to: email,
        userId,
        vars: {
          learner_name: (profile as { full_name?: string | null }).full_name || 'there',
          course_title: courseTitle,
          title: input.title,
          message: input.message,
          action_url: input.actionUrl || `/learn/${input.courseId}`,
        },
      })
      if (!result.sent && result.error) {
        console.error('[notify-enrolled] templated email failed:', result.error)
      }
    }
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
