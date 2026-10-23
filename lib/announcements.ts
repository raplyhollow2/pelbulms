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
