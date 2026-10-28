/**
 * Course Insights (audience=instructor) organization scope:
 * learner home orgs on courses the viewer owns/staffs, plus course audience links.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type Db = SupabaseClient<any>

export function unionInstitutionIds(...lists: Array<Iterable<string | null | undefined>>): string[] {
  const set = new Set<string>()
  for (const list of lists) {
    for (const id of list) {
      if (id) set.add(id)
    }
  }
  return [...set]
}

/** Owned + staff course ids (never platform-wide). */
export async function teachCourseIds(db: Db, userId: string): Promise<string[]> {
  const [{ data: owned }, { data: staff }] = await Promise.all([
    db.from('courses').select('id').eq('instructor_id', userId),
    db.from('course_instructors').select('course_id').eq('user_id', userId),
  ])
  const ids = new Set<string>()
  for (const c of owned || []) {
    const id = (c as { id?: string | null }).id
    if (id) ids.add(id)
  }
  for (const s of staff || []) {
    const id = (s as { course_id?: string | null }).course_id
    if (id) ids.add(id)
  }
  return [...ids]
}

export async function loadHomeOrgByUser(
  db: Db,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const unique = [...new Set(userIds.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100)
    const { data, error } = await db
      .from('profiles')
      .select('id, institution_id')
      .in('id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{ id?: string; institution_id?: string | null }>) {
      if (!row.id) continue
      map.set(row.id, row.institution_id || null)
    }
  }
  return map
}

export function filterEnrollmentsByLearnerHomeOrg<T extends { user_id?: string | null }>(
  enrollments: T[],
  homeOrgByUser: Map<string, string | null>,
  institutionId: string
): T[] {
  return enrollments.filter((e) => {
    const uid = e.user_id
    if (!uid) return false
    return homeOrgByUser.get(uid) === institutionId
  })
}

export function filterRowsByUserIds<T extends { user_id?: string | null }>(
  rows: T[],
  allowedUserIds: Set<string>
): T[] {
  return rows.filter((row) => Boolean(row.user_id && allowedUserIds.has(row.user_id)))
}

async function audienceInstitutionIdsForCourses(
  db: Db,
  courseIds: string[]
): Promise<string[]> {
  if (!courseIds.length) return []
  const ids: string[] = []
  for (let i = 0; i < courseIds.length; i += 100) {
    const slice = courseIds.slice(i, i + 100)
    const { data, error } = await db
      .from('course_institutions')
      .select('institution_id')
      .in('course_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{ institution_id?: string | null }>) {
      if (row.institution_id) ids.push(row.institution_id)
    }
  }
  return ids
}

async function learnerHomeInstitutionIdsForCourses(
  db: Db,
  courseIds: string[]
): Promise<string[]> {
  if (!courseIds.length) return []
  const userIds: string[] = []
  for (let i = 0; i < courseIds.length; i += 100) {
    const slice = courseIds.slice(i, i + 100)
    const { data, error } = await db
      .from('enrollments')
      .select('user_id')
      .in('course_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{ user_id?: string | null }>) {
      if (row.user_id) userIds.push(row.user_id)
    }
  }
  const home = await loadHomeOrgByUser(db, userIds)
  return [...home.values()].filter((id): id is string => Boolean(id))
}

/** Distinct orgs for Course Insights filters: enrollee home orgs ∪ course audience. */
export async function teachInstitutionIds(db: Db, userId: string): Promise<string[]> {
  const courseIds = await teachCourseIds(db, userId)
  if (!courseIds.length) return []
  const [audience, homes] = await Promise.all([
    audienceInstitutionIdsForCourses(db, courseIds),
    learnerHomeInstitutionIdsForCourses(db, courseIds),
  ])
  return unionInstitutionIds(audience, homes)
}

/**
 * Per-course institution ids for the scope bar: audience links ∪ enrollee home orgs.
 * Used so selecting an org keeps courses that have learners (or audience) for that org.
 */
export async function teachInstitutionIdsByCourse(
  db: Db,
  courseIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const unique = [...new Set(courseIds.filter(Boolean))]
  if (!unique.length) return map

  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100)
    const { data, error } = await db
      .from('course_institutions')
      .select('course_id, institution_id')
      .in('course_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{
      course_id?: string | null
      institution_id?: string | null
    }>) {
      if (!row.course_id || !row.institution_id) continue
      const list = map.get(row.course_id) || []
      if (!list.includes(row.institution_id)) list.push(row.institution_id)
      map.set(row.course_id, list)
    }
  }

  const enrollments: Array<{ course_id: string; user_id: string }> = []
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100)
    const { data, error } = await db
      .from('enrollments')
      .select('course_id, user_id')
      .in('course_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{
      course_id?: string | null
      user_id?: string | null
    }>) {
      if (row.course_id && row.user_id) {
        enrollments.push({ course_id: row.course_id, user_id: row.user_id })
      }
    }
  }

  const homeOrgByUser = await loadHomeOrgByUser(
    db,
    enrollments.map((e) => e.user_id)
  )
  for (const e of enrollments) {
    const home = homeOrgByUser.get(e.user_id)
    if (!home) continue
    const list = map.get(e.course_id) || []
    if (!list.includes(home)) list.push(home)
    map.set(e.course_id, list)
  }

  return map
}
