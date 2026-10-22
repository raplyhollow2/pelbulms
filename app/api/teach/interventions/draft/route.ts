import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { AiDispatchError, runText } from '@/lib/ai/dispatch'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function POST(request: NextRequest) {
  const rbac = await enforceCapability(
    request,
    [CAP.MODULE_INTERVENTIONS_VIEW, CAP.MODULE_INTERVENTIONS_CONFIGURE],
    [...TEACHER_ROLES]
  )
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : ''
  const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
  const brief = typeof body?.brief === 'string' ? body.brief.trim().slice(0, 500) : ''
  if (!courseId || !studentId) {
    return NextResponse.json({ error: 'courseId and studentId are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: student }, { data: course }, { data: enrollment }] = await Promise.all([
    service.from('profiles').select('id, full_name').eq('id', studentId).maybeSingle(),
    service.from('courses').select('id, title').eq('id', courseId).maybeSingle(),
    service
      .from('enrollments')
      .select('progress_percentage, last_accessed_at, status')
      .eq('course_id', courseId)
      .eq('user_id', studentId)
      .maybeSingle(),
  ])

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const learnerName = (student as { full_name?: string | null }).full_name || 'Learner'
  const courseTitle = (course as { title?: string | null }).title || 'the course'
  const progress =
    typeof (enrollment as { progress_percentage?: number | null } | null)?.progress_percentage ===
    'number'
      ? Math.round((enrollment as { progress_percentage: number }).progress_percentage)
      : null
  const lastAccessed = (enrollment as { last_accessed_at?: string | null } | null)?.last_accessed_at
  const lastAccessedLabel = lastAccessed
    ? new Date(lastAccessed).toLocaleDateString()
    : 'unknown / never'

  try {
    const result = await runText({
      feature: 'intervention-draft',
      userId: rbac.userId,
      audience: 'instructor',
      system: [
        'You draft a short follow-up message from a teacher to one learner in an LMS.',
        'Return plain text only — no subject line, no HTML, no markdown, no bullet lists.',
        'Write 2 to 4 short supportive sentences in a warm, professional teacher tone.',
        'Do not invent URLs, email addresses, grades, or facts not provided.',
        'Do not mention that you are an AI.',
        'Address the learner by first name when a name is provided.',
      ].join(' '),
      prompt: [
        `Learner: ${learnerName}`,
        `Course: ${courseTitle}`,
        `Progress: ${progress === null ? 'unknown' : `${progress}%`}`,
        `Last accessed: ${lastAccessedLabel}`,
        brief ? `Teacher note: ${brief}` : 'Teacher note: (none — write a gentle progress reminder)',
        'Draft the message the teacher will send.',
      ].join('\n'),
    })

    const message = result.text.trim().slice(0, 2000)
    if (!message) {
      return NextResponse.json({ error: 'The draft was empty. Try again.' }, { status: 422 })
    }
    return NextResponse.json({ message })
  } catch (error) {
    const message =
      error instanceof AiDispatchError ? error.message : 'Could not draft this message'
    const status = error instanceof AiDispatchError ? error.status : 502
    return NextResponse.json({ error: message }, { status })
  }
}
