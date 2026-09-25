/** Destinations teachers and superadmins use to act on a report finding. */

export const APPROVALS_HREF = '/admin/users?tab=approvals'
export const REVIEWERS_HREF = '/admin/users?tab=reviewers'
export const PERMISSIONS_HREF = '/admin/permissions'
export const REGISTRATION_SETTINGS_HREF = '/admin/settings/registration'
export const INSTITUTIONS_SETTINGS_HREF = '/admin/settings/institutions'

export function courseRosterHref(courseId: string) {
  return `/teach/courses/${courseId}/students`
}

export function learnerHref(courseId: string, studentId: string) {
  return `/teach/courses/${courseId}/students/${studentId}`
}

export function gradingHref(
  courseId: string,
  opts?: { lessonId?: string; activityId?: string }
) {
  const params = new URLSearchParams()
  if (opts?.lessonId) params.set('lessonId', opts.lessonId)
  if (opts?.activityId) params.set('activityId', opts.activityId)
  const query = params.toString()
  return `/teach/courses/${courseId}/grading${query ? `?${query}` : ''}`
}

export function lessonHref(courseId: string, lessonId: string) {
  return `/teach/courses/${courseId}/lessons/${lessonId}`
}

export function courseEditHref(courseId: string) {
  return `/teach/courses/${courseId}/edit`
}

export function institutionCatalogHref(slug?: string | null) {
  if (slug) return `/courses?institution=${encodeURIComponent(slug)}`
  return INSTITUTIONS_SETTINGS_HREF
}

/** In-app heartbeat path, when it is a same-origin route. */
export function internalPathHref(path?: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return undefined
  return path
}

export function reportFocusHref(surface: 'teach' | 'admin', blockId: string) {
  const base = surface === 'teach' ? '/teach/reports' : '/admin/reports'
  return `${base}?focus=${encodeURIComponent(blockId)}`
}
