import { sendTemplatedEmail } from '@/lib/email/templated'
import { tryCreateServiceClient } from '@/lib/supabase/server'

type DeliveryRow = {
  id: string
  dedupe_key: string
  template_key: string
  user_id: string | null
  to_email: string
  attempts: number
  payload: Record<string, unknown> | null
}

function payloadVars(payload: Record<string, unknown> | null): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(payload || {})) {
    if (typeof value === 'string') vars[key] = value
  }
  return vars
}

function moduleIdFromKey(dedupeKey: string): string | null {
  const parts = dedupeKey.split(':')
  return parts.length >= 2 ? parts[1] : null
}

async function releaseStillDue(
  service: NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>,
  row: DeliveryRow
): Promise<boolean> {
  if (row.template_key !== 'module.published' && row.template_key !== 'module.unpublished') return true
  const moduleId = moduleIdFromKey(row.dedupe_key)
  if (!moduleId) return false
  const { data } = await (service as any)
    .from('modules')
    .select('availability, publish_at')
    .eq('id', moduleId)
    .maybeSingle()
  if (!data) return false
  const availability = (data as { availability?: string }).availability
  const publishAt = (data as { publish_at?: string | null }).publish_at
  const due = Boolean(publishAt) && new Date(publishAt as string).getTime() <= Date.now()
  const live = availability === 'published' || (availability === 'scheduled' && due)
  if (row.template_key === 'module.published') return live
  return !live
}

async function deliverRow(
  service: NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>,
  row: DeliveryRow
): Promise<boolean> {
  const stillDue = await releaseStillDue(service, row)
  if (!stillDue) {
    await (service as any)
      .from('email_deliveries')
      .update({ status: 'skipped', last_error: 'Release was cancelled' })
      .eq('id', row.id)
    return false
  }

  const result = await sendTemplatedEmail({
    templateKey: row.template_key,
    to: row.to_email,
    userId: row.user_id,
    vars: payloadVars(row.payload),
  })

  if (result.sent) {
    await (service as any)
      .from('email_deliveries')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      .eq('id', row.id)
    return true
  }

  if (result.skipped || !result.error) {
    await (service as any)
      .from('email_deliveries')
      .update({ status: 'skipped', last_error: result.error || null })
      .eq('id', row.id)
    return false
  }

  const dead = row.attempts >= 5
  await (service as any)
    .from('email_deliveries')
    .update({
      status: dead ? 'dead' : 'pending',
      last_error: result.error.slice(0, 240),
    })
    .eq('id', row.id)
  return false
}

export type MailCount = {
  enrolled: number
  sent: number
  notSent: number
  alreadySent?: boolean
}

function pendingMatch(id: string, prefixes: string[]) {
  return prefixes.map((prefix) => `dedupe_key.like."${prefix}:${id}:%"`).join(',')
}

async function sendPending(match: string): Promise<number> {
  const service = await tryCreateServiceClient()
  if (!service) return 0

  const { data: pending } = await (service as any)
    .from('email_deliveries')
    .select('id, dedupe_key, template_key, user_id, to_email, attempts, payload, status')
    .eq('status', 'pending')
    .or(match)
    .limit(2000)

  let sent = 0
  for (const row of (pending || []) as DeliveryRow[]) {
    const { data: claimed } = await (service as any)
      .from('email_deliveries')
      .update({ claimed_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id, dedupe_key, template_key, user_id, to_email, attempts, payload')
      .maybeSingle()
    if (!claimed) continue
    if (await deliverRow(service, claimed as DeliveryRow)) sent += 1
  }
  return sent
}

export async function countEnrolledStudents(courseId: string): Promise<number> {
  const service = await tryCreateServiceClient()
  if (!service) return 0
  const { count } = await (service as any)
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .in('status', ['active', 'completed'])
  return count || 0
}

export function mailCount(enrolled: number, sent: number, alreadySent = false): MailCount {
  return { enrolled, sent, notSent: Math.max(enrolled - sent, 0), alreadySent }
}

async function modulePublishPrefix(moduleId: string): Promise<{ prefix: string; generation: number } | null> {
  const service = await tryCreateServiceClient()
  if (!service) return null
  const { data } = await (service as any)
    .from('modules')
    .select('release_generation')
    .eq('id', moduleId)
    .maybeSingle()
  if (!data) return null
  const generation = Number((data as { release_generation?: number }).release_generation) || 0
  return { prefix: `module_published:${moduleId}:${generation}:`, generation }
}

export async function countModulePublishSent(moduleId: string): Promise<number> {
  const service = await tryCreateServiceClient()
  const key = await modulePublishPrefix(moduleId)
  if (!service || !key) return 0
  const { count } = await (service as any)
    .from('email_deliveries')
    .select('id', { count: 'exact', head: true })
    .like('dedupe_key', `${key.prefix}%`)
    .eq('status', 'sent')
  return count || 0
}

/** Queue module-published mail when the module was already live and the trigger did not. */
export async function ensureModulePublishQueued(moduleId: string): Promise<void> {
  const service = await tryCreateServiceClient()
  const key = await modulePublishPrefix(moduleId)
  if (!service || !key) return

  const { count } = await (service as any)
    .from('email_deliveries')
    .select('id', { count: 'exact', head: true })
    .like('dedupe_key', `${key.prefix}%`)
  if (count) return

  const { data: template } = await (service as any)
    .from('email_templates')
    .select('enabled')
    .eq('key', 'module.published')
    .maybeSingle()
  if ((template as { enabled?: boolean } | null)?.enabled !== true) return

  const { data: moduleRow } = await (service as any)
    .from('modules')
    .select('id, title, course_id, availability')
    .eq('id', moduleId)
    .maybeSingle()
  const courseId = (moduleRow as { course_id?: string; availability?: string; title?: string } | null)?.course_id
  const title = (moduleRow as { title?: string } | null)?.title || 'A module'
  if (!courseId || (moduleRow as { availability?: string }).availability !== 'published') return

  const { data: course } = await (service as any)
    .from('courses')
    .select('title, is_published')
    .eq('id', courseId)
    .maybeSingle()
  if ((course as { is_published?: boolean } | null)?.is_published !== true) return
  const courseTitle = (course as { title?: string }).title || 'Your course'
  const action = `/learn/${courseId}`

  const { data: enrollments } = await (service as any)
    .from('enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .in('status', ['active', 'completed'])
  const userIds = ((enrollments || []) as { user_id: string }[]).map((row) => row.user_id).filter(Boolean)
  if (!userIds.length) return

  const { data: profiles } = await (service as any)
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)
  const people = (profiles || []) as { id: string; email?: string | null; full_name?: string | null }[]

  const notices = people.map((person) => ({
    user_id: person.id,
    type: 'module_published',
    title: `${title} is now available`.slice(0, 500),
    message: `${courseTitle}: ${title} is now open.`,
    action_url: action,
    is_read: false,
    metadata: { dedupe_key: `${key.prefix}${person.id}`, course_id: courseId },
  }))
  if (notices.length) await (service as any).from('notifications').insert(notices)

  const deliveries = people
    .filter((person) => person.email && person.email.trim())
    .map((person) => ({
      dedupe_key: `${key.prefix}${person.id}`,
      template_key: 'module.published',
      user_id: person.id,
      to_email: person.email!.trim(),
      status: 'pending',
      payload: {
        learner_name: person.full_name?.trim() || 'there',
        course_title: courseTitle,
        module_title: title,
        action_url: action,
      },
    }))
  if (deliveries.length) {
    await (service as any).from('email_deliveries').upsert(deliveries, {
      onConflict: 'dedupe_key',
      ignoreDuplicates: true,
    })
  }
}

/** Send the queued lesson published or unpublished emails for one lesson. */
export async function sendQueuedLessonMail(lessonId: string): Promise<number> {
  return sendPending(pendingMatch(lessonId, ['lesson_published', 'lesson_unpublished']))
}

/** Queue one course-published email per enrolled student for this publish time. */
export async function ensureCoursePublishQueued(courseId: string): Promise<void> {
  const service = await tryCreateServiceClient()
  if (!service) return
  const { data: course } = await (service as any)
    .from('courses')
    .select('title, is_published, updated_at')
    .eq('id', courseId)
    .maybeSingle()
  if ((course as { is_published?: boolean } | null)?.is_published !== true) return
  const updatedAt = (course as { updated_at?: string }).updated_at || ''
  const generation = updatedAt ? new Date(updatedAt).getTime() : 0
  const prefix = `course_published:${courseId}:${generation}:`
  const { count } = await (service as any)
    .from('email_deliveries')
    .select('id', { count: 'exact', head: true })
    .like('dedupe_key', `${prefix}%`)
  if (count) return

  const { data: template } = await (service as any)
    .from('email_templates')
    .select('enabled')
    .eq('key', 'course.published')
    .maybeSingle()
  if ((template as { enabled?: boolean } | null)?.enabled !== true) return

  const courseTitle = (course as { title?: string }).title || 'Your course'
  const action = `/courses/${courseId}`
  const { data: enrollments } = await (service as any)
    .from('enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .in('status', ['active', 'completed'])
  const userIds = ((enrollments || []) as { user_id: string }[]).map((row) => row.user_id).filter(Boolean)
  if (!userIds.length) return
  const { data: profiles } = await (service as any)
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)
  const people = (profiles || []) as { id: string; email?: string | null; full_name?: string | null }[]
  const notices = people.map((person) => ({
    user_id: person.id,
    type: 'course_published',
    title: `${courseTitle} is now available`.slice(0, 500),
    message: `${courseTitle} is now open.`,
    action_url: action,
    is_read: false,
    metadata: { dedupe_key: `${prefix}${person.id}`, course_id: courseId },
  }))
  if (notices.length) await (service as any).from('notifications').insert(notices)
  const deliveries = people
    .filter((person) => person.email && person.email.trim())
    .map((person) => ({
      dedupe_key: `${prefix}${person.id}`,
      template_key: 'course.published',
      user_id: person.id,
      to_email: person.email!.trim(),
      status: 'pending',
      payload: {
        learner_name: person.full_name?.trim() || 'there',
        course_title: courseTitle,
        action_url: action,
      },
    }))
  if (deliveries.length) {
    await (service as any).from('email_deliveries').upsert(deliveries, {
      onConflict: 'dedupe_key',
      ignoreDuplicates: true,
    })
  }
}

export async function sendQueuedCourseMail(courseId: string, generation: number): Promise<number> {
  return sendPending(`dedupe_key.like."course_published:${courseId}:${generation}:%"`)
}

/** Send the queued module published or unpublished emails for one module. */
export async function sendQueuedModuleMail(moduleId: string): Promise<number> {
  return sendPending(pendingMatch(moduleId, ['module_published', 'module_unpublished']))
}

/** Send lesson emails that a module publish queued for lessons with their own switch on. */
export async function sendQueuedLessonsForModule(moduleId: string): Promise<number> {
  const service = await tryCreateServiceClient()
  if (!service) return 0
  const { data } = await (service as any)
    .from('lessons')
    .select('id')
    .eq('module_id', moduleId)
    .eq('notify_on_status', true)
  let sent = 0
  for (const lesson of (data || []) as { id: string }[]) {
    sent += await sendQueuedLessonMail(lesson.id)
  }
  return sent
}

export async function runReleaseWorker(): Promise<{ released: number; claimed: number; sent: number }> {
  const service = await tryCreateServiceClient()
  if (!service) return { released: 0, claimed: 0, sent: 0 }

  const now = new Date().toISOString()
  const { data: due, error: releaseError } = await (service as any)
    .from('modules')
    .update({ availability: 'published', updated_at: now })
    .eq('availability', 'scheduled')
    .lte('publish_at', now)
    .select('id')
  if (releaseError) console.error('[release-worker] release failed', releaseError.message)

  const { data: claimed, error } = await (service as any).rpc('claim_email_deliveries', { p_limit: 40 })
  if (error) {
    console.error('[release-worker] claim failed', error.message)
    return { released: (due || []).length, claimed: 0, sent: 0 }
  }

  const rows = (claimed || []) as DeliveryRow[]
  let sent = 0
  for (const row of rows) {
    if (await deliverRow(service, row)) sent += 1
  }

  return { released: (due || []).length, claimed: rows.length, sent }
}
