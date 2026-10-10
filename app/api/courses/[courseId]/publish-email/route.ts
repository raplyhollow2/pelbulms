import { NextRequest, NextResponse } from 'next/server'
import { userCanManageCourse } from '@/lib/course-access'
import {
  countEnrolledStudents,
  ensureCoursePublishQueued,
  mailCount,
  sendQueuedCourseMail,
} from '@/lib/email/release-worker'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, user.id, user.role || undefined))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: course } = await (service as any)
    .from('courses')
    .select('id, is_published, updated_at')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if ((course as { is_published?: boolean }).is_published !== true) {
    return NextResponse.json({ error: 'Publish the course first.' }, { status: 400 })
  }

  const updatedAt = (course as { updated_at?: string }).updated_at || ''
  const generation = updatedAt ? new Date(updatedAt).getTime() : 0
  const prefix = `course_published:${courseId}:${generation}:`
  const { count: prior } = await (service as any)
    .from('email_deliveries')
    .select('id', { count: 'exact', head: true })
    .like('dedupe_key', `${prefix}%`)
    .eq('status', 'sent')

  await ensureCoursePublishQueued(courseId)
  const [sent, enrolled] = await Promise.all([
    sendQueuedCourseMail(courseId, generation),
    countEnrolledStudents(courseId),
  ])
  return NextResponse.json({ mail: mailCount(enrolled, sent, (prior || 0) > 0 && sent === 0) })
}
