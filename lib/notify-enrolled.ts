/**
 * Notify enrolled students about course events (announcements, etc.).
 */

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
  const { error } = await service.from('notifications').insert({
    user_id: input.studentId,
    type: input.approved ? 'enrollment_approved' : 'enrollment_rejected',
    title: input.approved ? 'Enrollment approved' : 'Enrollment not approved',
    message: input.approved
      ? `You are now enrolled in “${input.courseTitle}”. Start learning anytime.`
      : `Your request to join “${input.courseTitle}” was not approved by the course creator.`,
    action_url: input.approved
      ? `/learn/${input.courseId}`
      : `/courses/${input.courseId}`,
    is_read: false,
    metadata: {
      course_id: input.courseId,
      event: input.approved ? 'enrollment_approved' : 'enrollment_rejected',
    },
  })
  if (error) {
    console.error('[notify-enrolled] decision notify failed:', error)
    return false
  }
  return true
}
