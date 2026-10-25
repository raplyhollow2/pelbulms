import { templateTokens } from '@/lib/email/template-render'

/** Merge fields the announcement send can fill. Other template fields stay blank. */
export const ANNOUNCEMENT_EMAIL_VARS = [
  'learner_name',
  'course_title',
  'title',
  'message',
  'action_url',
] as const

export const GLOBAL_COURSE_VALUE = 'global'

export const ANNOUNCEMENT_MESSAGE_CAP = 20000

export function isGlobalCourse(courseId: string | null | undefined) {
  return !courseId || courseId === GLOBAL_COURSE_VALUE
}

/** True when the template subject is the announcement title and the body is its content. */
export function announcementTemplateUsesCopy(parts: {
  subject?: string | null
  text_body?: string | null
  html_body?: string | null
}) {
  const subject = templateTokens(parts.subject || '')
  const body = templateTokens(`${parts.text_body || ''}\n${parts.html_body || ''}`)
  return subject.includes('title') && body.includes('message')
}
