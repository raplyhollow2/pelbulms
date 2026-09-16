// @ts-nocheck - course_institutions may not be in generated Database types yet
import type { UserRole } from '@/lib/roles'
import { canAccessTeaching } from '@/lib/roles'

export type InstitutionSummary = {
  id: string
  name: string
  slug: string
  display_name: string | null
  is_active?: boolean
}

export type CourseInstitutionLink = {
  institution_id: string
  institutions?: InstitutionSummary | InstitutionSummary[] | null
}

export function institutionLabel(inst: Pick<InstitutionSummary, 'name' | 'display_name'> | null | undefined) {
  if (!inst) return 'Institution'
  return (inst.display_name || inst.name || 'Institution').trim()
}

export function normalizeInstitutionEmbed(
  row: CourseInstitutionLink
): InstitutionSummary | null {
  const raw = row.institutions
  if (!raw) return null
  const inst = Array.isArray(raw) ? raw[0] : raw
  if (!inst?.id) return null
  return {
    id: inst.id,
    name: inst.name,
    slug: inst.slug,
    display_name: inst.display_name ?? null,
    is_active: inst.is_active,
  }
}

export function courseInstitutionIdsFromRows(
  rows: Array<{ institution_id?: string } | null> | null | undefined
): string[] {
  if (!rows?.length) return []
  return [
    ...new Set(
      rows
        .map((r) => r?.institution_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
}

export function isCourseOpenToAll(institutionIds: string[] | null | undefined) {
  return !institutionIds || institutionIds.length === 0
}

/**
 * Hybrid visibility: open courses for everyone; restricted courses only for
 * matching institution members (or teaching/admin staff).
 */
export function userCanSeeCourseAudience(opts: {
  institutionIds: string[] | null | undefined
  userInstitutionId: string | null | undefined
  role?: string | null
  isInstructorOrStaff?: boolean
  isEnrolled?: boolean
}): boolean {
  if (opts.isInstructorOrStaff || opts.isEnrolled) return true
  if (canAccessTeaching(opts.role as UserRole | null | undefined)) return true
  if (isCourseOpenToAll(opts.institutionIds)) return true
  if (!opts.userInstitutionId) return false
  return (opts.institutionIds || []).includes(opts.userInstitutionId)
}

export function filterVisibleCourses<T extends { id: string }>(
  courses: T[],
  institutionIdsByCourse: Map<string, string[]>,
  opts: {
    userInstitutionId: string | null | undefined
    role?: string | null
  }
): T[] {
  return courses.filter((course) =>
    userCanSeeCourseAudience({
      institutionIds: institutionIdsByCourse.get(course.id) || [],
      userInstitutionId: opts.userInstitutionId,
      role: opts.role,
    })
  )
}

/** Catalog chip filter after visibility gate */
export function matchesInstitutionFilter(
  courseInstitutionIds: string[],
  filter: string,
  userInstitutionId: string | null | undefined
): boolean {
  if (filter === 'All' || !filter) return true
  if (filter === 'mine') {
    if (!userInstitutionId) return isCourseOpenToAll(courseInstitutionIds)
    return (
      isCourseOpenToAll(courseInstitutionIds) ||
      courseInstitutionIds.includes(userInstitutionId)
    )
  }
  // filter is institution id
  return (
    isCourseOpenToAll(courseInstitutionIds) ||
    courseInstitutionIds.includes(filter)
  )
}

export type AudienceBadge =
  | { kind: 'open'; label: string }
  | { kind: 'single'; label: string; institutionId: string }
  | { kind: 'multi'; label: string; count: number }

export function audienceBadgeForCourse(
  institutions: InstitutionSummary[]
): AudienceBadge {
  if (!institutions.length) {
    return { kind: 'open', label: 'Open to all' }
  }
  if (institutions.length === 1) {
    return {
      kind: 'single',
      label: institutionLabel(institutions[0]),
      institutionId: institutions[0].id,
    }
  }
  return {
    kind: 'multi',
    label: `${institutions.length} institutions`,
    count: institutions.length,
  }
}

type DbLike = {
  from: (table: string) => any
}

/**
 * Server-side check used by enrollment API. Uses service client (bypasses RLS).
 */
export async function assertUserMayEnrollInCourse(
  service: DbLike,
  courseId: string,
  userId: string,
  role?: string | null
): Promise<{ ok: true } | { ok: false; status: number; error: string; institutionNames?: string[] }> {
  if (canAccessTeaching(role as UserRole | null | undefined)) {
    return { ok: true }
  }

  const { data: links } = await service
    .from('course_institutions')
    .select('institution_id, institutions:institution_id ( id, name, display_name )')
    .eq('course_id', courseId)

  const institutionIds = courseInstitutionIdsFromRows(links || [])
  if (isCourseOpenToAll(institutionIds)) {
    return { ok: true }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('institution_id')
    .eq('id', userId)
    .maybeSingle()

  const userInstitutionId = (profile as any)?.institution_id as string | null
  if (userInstitutionId && institutionIds.includes(userInstitutionId)) {
    return { ok: true }
  }

  const names = (links || [])
    .map((row: CourseInstitutionLink) => institutionLabel(normalizeInstitutionEmbed(row)))
    .filter(Boolean)

  const list =
    names.length > 0
      ? names.join(', ')
      : 'selected institutions'

  return {
    ok: false,
    status: 403,
    error: `This course is only available to members of ${list}.`,
    institutionNames: names,
  }
}

/**
 * Replace course_institutions rows for a course. Empty array = open to all.
 */
export async function syncCourseInstitutions(
  client: DbLike,
  courseId: string,
  institutionIds: string[]
): Promise<{ error: string | null }> {
  const unique = [...new Set(institutionIds.filter(Boolean))]

  const { error: delError } = await client
    .from('course_institutions')
    .delete()
    .eq('course_id', courseId)

  if (delError) {
    // Table may not exist yet in some envs
    if (/course_institutions|does not exist|schema cache/i.test(delError.message || '')) {
      return { error: null }
    }
    return { error: delError.message }
  }

  if (!unique.length) return { error: null }

  const { error: insError } = await client.from('course_institutions').insert(
    unique.map((institution_id) => ({
      course_id: courseId,
      institution_id,
    }))
  )

  if (insError) return { error: insError.message }
  return { error: null }
}

export async function loadCourseInstitutions(
  client: DbLike,
  courseId: string
): Promise<InstitutionSummary[]> {
  const { data, error } = await client
    .from('course_institutions')
    .select('institution_id, institutions:institution_id ( id, name, slug, display_name, is_active )')
    .eq('course_id', courseId)

  if (error || !data) return []
  return (data as CourseInstitutionLink[])
    .map(normalizeInstitutionEmbed)
    .filter((i): i is InstitutionSummary => Boolean(i))
}

export async function loadInstitutionsForCourses(
  client: DbLike,
  courseIds: string[]
): Promise<Map<string, InstitutionSummary[]>> {
  const map = new Map<string, InstitutionSummary[]>()
  if (!courseIds.length) return map

  const { data, error } = await client
    .from('course_institutions')
    .select(
      'course_id, institution_id, institutions:institution_id ( id, name, slug, display_name, is_active )'
    )
    .in('course_id', courseIds)

  if (error || !data) return map

  for (const row of data as Array<CourseInstitutionLink & { course_id: string }>) {
    const inst = normalizeInstitutionEmbed(row)
    if (!inst) continue
    const list = map.get(row.course_id) || []
    list.push(inst)
    map.set(row.course_id, list)
  }
  return map
}

/**
 * Count active/pending enrollments whose learner institution is outside the
 * selected audience (for soft warning when restricting).
 */
export async function countCrossInstitutionEnrollments(
  client: DbLike,
  courseId: string,
  allowedInstitutionIds: string[]
): Promise<number> {
  if (!allowedInstitutionIds.length) return 0

  const { data: enrollments } = await client
    .from('enrollments')
    .select('user_id, status')
    .eq('course_id', courseId)
    .in('status', ['active', 'pending', 'completed'])

  if (!enrollments?.length) return 0

  const userIds = enrollments.map((e: any) => e.user_id).filter(Boolean)
  if (!userIds.length) return 0

  const { data: profiles } = await client
    .from('profiles')
    .select('id, institution_id')
    .in('id', userIds)

  const allowed = new Set(allowedInstitutionIds)
  let count = 0
  for (const p of profiles || []) {
    const iid = (p as any).institution_id as string | null
    if (!iid || !allowed.has(iid)) count += 1
  }
  return count
}

/** Featured / marketing: only include open-to-all courses */
export async function filterOpenToAllCourseIds(
  service: DbLike,
  courseIds: string[]
): Promise<string[]> {
  if (!courseIds.length) return []
  const { data, error } = await service
    .from('course_institutions')
    .select('course_id')
    .in('course_id', courseIds)

  if (error) {
    // If table missing, treat all as open
    if (/course_institutions|does not exist|schema cache/i.test(error.message || '')) {
      return courseIds
    }
    return courseIds
  }

  const restricted = new Set((data || []).map((r: any) => r.course_id as string))
  return courseIds.filter((id) => !restricted.has(id))
}
