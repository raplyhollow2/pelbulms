import { NextRequest, NextResponse } from 'next/server'
import { userCanManageCourse } from '@/lib/course-access'
import {
  countEnrolledStudents,
  countModulePublishSent,
  ensureModulePublishQueued,
  mailCount,
  sendQueuedLessonsForModule,
  sendQueuedModuleMail,
} from '@/lib/email/release-worker'
import { getRequestUser } from '@/lib/request-user'
import { createServiceClient } from '@/lib/supabase/server'

const AVAILABILITY = new Set(['draft', 'scheduled', 'published'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; moduleId: string }> }
) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, moduleId } = await params
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, user.id, user.role || undefined))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const availability = typeof body?.availability === 'string' ? body.availability : ''
  if (!AVAILABILITY.has(availability)) {
    return NextResponse.json({ error: 'availability must be draft, scheduled, or published' }, { status: 400 })
  }

  const { data: existing } = await (service as any)
    .from('modules')
    .select('id, course_id, availability')
    .eq('id', moduleId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const patch: Record<string, unknown> = {
    availability,
    updated_at: new Date().toISOString(),
  }
  if (typeof body?.notifyOnPublish === 'boolean') patch.notify_on_publish = body.notifyOnPublish
  if (typeof body?.notifyOnUnpublish === 'boolean') patch.notify_on_unpublish = body.notifyOnUnpublish
  if (typeof body?.releaseLessons === 'boolean') patch.release_lessons = body.releaseLessons

  if (availability === 'scheduled') {
    const publishAt = typeof body?.publishAt === 'string' ? body.publishAt : ''
    const publishTimezone = typeof body?.publishTimezone === 'string' ? body.publishTimezone.trim() : ''
    if (!publishAt || !publishTimezone) {
      return NextResponse.json({ error: 'A scheduled module needs a publish time and timezone' }, { status: 400 })
    }
    patch.publish_at = publishAt
    patch.publish_timezone = publishTimezone
  }

  const { data, error } = await (service as any)
    .from('modules')
    .update(patch)
    .eq('id', moduleId)
    .select('id, availability, publish_at, publish_timezone, notify_on_publish, notify_on_unpublish, release_lessons, is_published, release_generation')
    .maybeSingle()

  if (error) {
    const message = String(error.message || 'Could not update this module')
    const friendly = message.includes('Schedule the module')
      ? 'Schedule the module more than a minute in the future.'
      : message.includes('Unknown timezone')
        ? 'Choose a valid timezone.'
        : message.includes('publish time')
          ? 'A scheduled module needs a publish time and timezone.'
          : 'Could not update this module.'
    return NextResponse.json({ error: friendly }, { status: 400 })
  }

  const wasPublished = (existing as { availability?: string }).availability === 'published'
  const nowPublished = (data as { availability?: string }).availability === 'published'
  const notify = (data as { notify_on_publish?: boolean }).notify_on_publish === true
  const notifyUnpublish = (data as { notify_on_unpublish?: boolean }).notify_on_unpublish === true
  const emailNow = body?.emailNow === true
  const publishedNow = nowPublished && !wasPublished && notify
  const unpublishedNow = wasPublished && !nowPublished && notifyUnpublish
  const emailThisPublish = nowPublished && notify && (publishedNow || emailNow)
  if (emailThisPublish || unpublishedNow) {
    const alreadySent = emailThisPublish ? await countModulePublishSent(moduleId) : 0
    if (emailThisPublish) await ensureModulePublishQueued(moduleId)
    const [sent, enrolled] = await Promise.all([
      sendQueuedModuleMail(moduleId),
      countEnrolledStudents(courseId),
      publishedNow ? sendQueuedLessonsForModule(moduleId) : Promise.resolve(0),
    ])
    return NextResponse.json({
      module: data,
      mail: mailCount(enrolled, sent, alreadySent > 0 && sent === 0),
    })
  }

  await sendQueuedModuleMail(moduleId)
  return NextResponse.json({ module: data, mail: null })
}
