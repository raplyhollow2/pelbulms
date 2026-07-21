/**
 * Notify course instructors when students enroll or complete.
 */

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

export async function notifyTeacherOfEnrollment(
  service: any,
  input: { courseId: string; studentId: string; pending?: boolean }
): Promise<boolean> {
  const { instructorId, courseTitle } = await resolveCourseInstructor(service, input.courseId)
  if (!instructorId || instructorId === input.studentId) return false

  const studentName = await resolveStudentName(service, input.studentId)
  const pending = Boolean(input.pending)

  return insertNotification(service, {
    user_id: instructorId,
    type: pending ? 'enrollment_request' : 'student_enrolled',
    title: pending ? 'Enrollment request' : 'New student enrolled',
    message: pending
      ? `${studentName} requested to join “${courseTitle}”. Approve or reject on the students page.`
      : `${studentName} enrolled in “${courseTitle}”.`,
    action_url: `/teach/courses/${input.courseId}/students`,
    metadata: {
      course_id: input.courseId,
      student_id: input.studentId,
      event: pending ? 'enrollment_request' : 'enrolled',
    },
  })
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
