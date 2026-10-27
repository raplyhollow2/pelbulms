/**
 * Report scope: which institutions/courses a viewer may filter to,
 * and authorization for snapshot query params.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { adminOrganizationIds } from '@/lib/admin-org-scope'
import { getApprovalScope } from '@/lib/approvals-access'
import { userCanManageCourse } from '@/lib/course-access'
import { courseIdsForTeacher } from '@/lib/reports/compute-teach'
import type { UserRole } from '@/lib/rbac'

type Db = SupabaseClient<any>

export type ReportScopeFilters = {
  courseId?: string | null
  institutionId?: string | null
  enrollmentStatus?: string | null
}

export type ScopeOption = { id: string; name: string; institutionIds?: string[] }

export type ReportScopeOptions = {
  institutions: ScopeOption[]
  courses: ScopeOption[]
  /** Null = platform-wide (no org restriction by default). */
  defaultInstitutionIds: string[] | null
}

const ENROLLMENT_STATUSES = new Set([
  'active',
  'pending',
  'completed',
  'dropped',
  'suspended',
  'rejected',
])

export function parseEnrollmentStatus(raw: string | null | undefined): string | null {
  if (!raw || raw === 'all') return null
  return ENROLLMENT_STATUSES.has(raw) ? raw : null
}

/** Institutions the user may select in the scope bar. Null = all (superadmin / platform admin). */
export async function allowedInstitutionIds(
  db: Db,
  userId: string,
  role: string,
  profileInstitutionId?: string | null
): Promise<string[] | null> {
  if (role === 'superadmin') return null

  if (role === 'admin') {
    return adminOrganizationIds(db, userId)
  }

  if (role === 'resource_person') {
    const scope = await getApprovalScope(db, userId, role, profileInstitutionId)
    if (!scope.allowed) return []
    if (scope.isSuper) return null
    return scope.institutionIds
  }

  // Instructors: orgs linked to courses they teach
  const courseIds = await courseIdsForTeacher(db, userId)
  if (!courseIds.length) return []
  const { data } = await db
    .from('course_institutions')
    .select('institution_id')
    .in('course_id', courseIds)
  return [
    ...new Set(
      ((data || []) as { institution_id?: string | null }[])
        .map((r) => r.institution_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
}

async function coursesForInstitutionIds(
  db: Db,
  institutionIds: string[]
): Promise<string[]> {
  if (!institutionIds.length) return []
  const { data } = await db
    .from('course_institutions')
    .select('course_id')
    .in('institution_id', institutionIds)
  return [
    ...new Set(
      ((data || []) as { course_id?: string | null }[])
        .map((r) => r.course_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
}

/** Course ids the viewer may pick (optionally narrowed by institution). */
export async function allowedCourseIds(
  db: Db,
  userId: string,
  role: string,
  institutionId?: string | null
): Promise<string[] | null> {
  if (role === 'superadmin') {
    if (institutionId) return coursesForInstitutionIds(db, [institutionId])
    return null
  }

  if (role === 'admin') {
    const orgs = await adminOrganizationIds(db, userId)
    if (orgs === null) {
      if (institutionId) return coursesForInstitutionIds(db, [institutionId])
      return null
    }
    if (institutionId) {
      if (!orgs.includes(institutionId)) return []
      return coursesForInstitutionIds(db, [institutionId])
    }
    return coursesForInstitutionIds(db, orgs)
  }

  if (role === 'resource_person') {
    let ids = await courseIdsForTeacher(db, userId, { allCourses: true })
    if (institutionId) {
      const linked = new Set(await coursesForInstitutionIds(db, [institutionId]))
      ids = ids.filter((id) => linked.has(id))
    }
    return ids
  }

  // Instructor / teaching staff
  let ids = await courseIdsForTeacher(db, userId)
  if (institutionId) {
    const linked = new Set(await coursesForInstitutionIds(db, [institutionId]))
    ids = ids.filter((id) => linked.has(id))
  }
  return ids
}

export async function listReportScopeOptions(
  db: Db,
  userId: string,
  role: string,
  profileInstitutionId?: string | null
): Promise<ReportScopeOptions> {
  const defaultInstitutionIds = await allowedInstitutionIds(
    db,
    userId,
    role,
    profileInstitutionId
  )
  const courseIds = await allowedCourseIds(db, userId, role, null)

  let institutions: ScopeOption[] = []
  if (defaultInstitutionIds === null) {
    const { data } = await db
      .from('institutions')
      .select('id, name, display_name')
      .order('name')
      .limit(500)
    institutions = ((data || []) as any[]).map((i) => ({
      id: i.id,
      name: i.display_name || i.name || 'Institution',
    }))
  } else if (defaultInstitutionIds.length) {
    const { data } = await db
      .from('institutions')
      .select('id, name, display_name')
      .in('id', defaultInstitutionIds)
      .order('name')
    institutions = ((data || []) as any[]).map((i) => ({
      id: i.id,
      name: i.display_name || i.name || 'Institution',
    }))
  }

  let courseRows: Array<{ id: string; title: string | null }> = []
  if (courseIds === null) {
    const { data, error } = await db.from('courses').select('id, title').order('title').limit(500)
    if (error) throw new Error(error.message)
    courseRows = (data || []) as Array<{ id: string; title: string | null }>
  } else if (courseIds.length) {
    const { data, error } = await db
      .from('courses')
      .select('id, title')
      .in('id', courseIds)
      .order('title')
    if (error) throw new Error(error.message)
    courseRows = (data || []) as Array<{ id: string; title: string | null }>
  }

  const links = await institutionIdsByCourse(
    db,
    courseRows.map((course) => course.id)
  )
  const courses: ScopeOption[] = courseRows.map((course) => ({
    id: course.id,
    name: course.title || 'Course',
    institutionIds: links.get(course.id) || [],
  }))

  return { institutions, courses, defaultInstitutionIds }
}

async function institutionIdsByCourse(db: Db, courseIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const unique = [...new Set(courseIds.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100)
    const { data, error } = await db
      .from('course_institutions')
      .select('course_id, institution_id')
      .in('course_id', slice)
    if (error) throw new Error(error.message)
    for (const row of (data || []) as Array<{ course_id?: string | null; institution_id?: string | null }>) {
      if (!row.course_id || !row.institution_id) continue
      const list = map.get(row.course_id) || []
      if (!list.includes(row.institution_id)) list.push(row.institution_id)
      map.set(row.course_id, list)
    }
  }
  return map
}

export type ScopeAuthResult =
  | { ok: true; filters: ReportScopeFilters; institutionIds: string[] | null }
  | { ok: false; status: 403; error: string }

/**
 * Validate courseId / institutionId against the viewer's access.
 * Returns institutionIds to apply to admin/approvals snapshots (null = platform-wide).
 */
export async function authorizeReportScope(
  db: Db,
  opts: {
    userId: string
    role: string
    profileInstitutionId?: string | null
    courseId?: string | null
    institutionId?: string | null
    enrollmentStatus?: string | null
  }
): Promise<ScopeAuthResult> {
  const courseId = opts.courseId?.trim() || null
  const institutionId = opts.institutionId?.trim() || null
  const enrollmentStatus = parseEnrollmentStatus(opts.enrollmentStatus)

  if (institutionId) {
    const allowed = await allowedInstitutionIds(
      db,
      opts.userId,
      opts.role,
      opts.profileInstitutionId
    )
    if (allowed !== null && !allowed.includes(institutionId)) {
      return { ok: false, status: 403, error: 'Institution not in your report scope' }
    }
  }

  if (courseId) {
    const can = await userCanManageCourse(
      db as any,
      courseId,
      opts.userId,
      opts.role as UserRole
    )
    if (!can) {
      return { ok: false, status: 403, error: 'Course not in your report scope' }
    }
    if (institutionId) {
      const linked = await coursesForInstitutionIds(db, [institutionId])
      if (!linked.includes(courseId)) {
        return {
          ok: false,
          status: 403,
          error: 'Course is not linked to the selected institution',
        }
      }
    }
  }

  // Default institution scope for snapshots
  let institutionIds: string[] | null = null
  const allowedOrgs = await allowedInstitutionIds(
    db,
    opts.userId,
    opts.role,
    opts.profileInstitutionId
  )

  if (institutionId) {
    institutionIds = [institutionId]
  } else if (allowedOrgs !== null) {
    institutionIds = allowedOrgs
  }

  return {
    ok: true,
    filters: { courseId, institutionId, enrollmentStatus },
    institutionIds,
  }
}
