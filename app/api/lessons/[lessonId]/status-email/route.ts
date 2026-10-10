import { NextRequest, NextResponse } from 'next/server'
import { userCanManageCourse } from '@/lib/course-access'
import { countEnrolledStudents, mailCount, sendQueuedLessonMail } from '@/lib/email/release-worker'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lessonId } = await params
  const service = await createServiceClient()
  const { data: lesson } = await (service as any)
    .from('lessons')
    .select('id, module_id')
    .eq('id', lessonId)
    .maybeSingle()
  const moduleId = (lesson as { module_id?: string } | null)?.module_id
  if (!moduleId) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  const { data: moduleRow } = await (service as any)
    .from('modules')
    .select('course_id')
    .eq('id', moduleId)
    .maybeSingle()
  const courseId = (moduleRow as { course_id?: string } | null)?.course_id
  if (!courseId) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (!(await userCanManageCourse(service, courseId, user.id, user.role || undefined))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sent = await sendQueuedLessonMail(lessonId)
  const enrolled = await countEnrolledStudents(courseId)
  return NextResponse.json(mailCount(enrolled, sent))
}
