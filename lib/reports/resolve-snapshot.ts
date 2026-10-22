import type { SupabaseClient } from '@supabase/supabase-js'
import { getApprovalScope } from '@/lib/approvals-access'
import { buildReportSnapshot } from '@/lib/reports/compute-executive'
import {
  buildApprovalsSnapshot,
  buildStudentSnapshot,
  buildTeachSnapshot,
} from '@/lib/reports/compute-role-snapshots'
import type { ReportRange, ReportSnapshot, SnapshotAudience } from '@/lib/reports/types'
import type { ReportScopeFilters } from '@/lib/reports/scope'

type Db = SupabaseClient<any>

export function roleToSnapshotAudience(role: string): SnapshotAudience | null {
  if (role === 'superadmin') return 'superadmin'
  if (role === 'admin') return 'admin'
  if (role === 'instructor') return 'instructor'
  if (role === 'resource_person') return 'resource_person'
  if (role === 'student') return 'student'
  return null
}

export async function resolveSnapshotForUser(
  db: Db,
  opts: {
    userId: string
    role: string
    range: ReportRange
    /** Prefer this audience when the user qualifies for multiple (e.g. RP on teach vs approvals). */
    prefer?: SnapshotAudience
    institutionId?: string | null
    instructorId?: string | null
    /** Authorized filters from authorizeReportScope */
    filters?: ReportScopeFilters
    /** Resolved institution list for admin/approvals (null = platform-wide). */
    institutionIds?: string[] | null
  }
): Promise<ReportSnapshot> {
  const prefer = opts.prefer
  const role = opts.role
  const filters = opts.filters || {}
  const courseId = filters.courseId || null
  const filterInstitutionId = filters.institutionId || null
  const enrollmentStatus = filters.enrollmentStatus || null

  if (prefer === 'instructor' || (role === 'instructor' && !prefer)) {
    const allCourses = role === 'superadmin' && !opts.instructorId
    return buildTeachSnapshot(db, {
      userId: opts.userId,
      range: opts.range,
      allCourses,
      instructorId: role === 'superadmin' ? opts.instructorId : null,
      courseId,
      institutionId: filterInstitutionId,
      enrollmentStatus,
    })
  }

  if (prefer === 'student' || role === 'student') {
    return buildStudentSnapshot(db, { userId: opts.userId, range: opts.range })
  }

  if (prefer === 'resource_person' || role === 'resource_person') {
    const scope = await getApprovalScope(db, opts.userId, role, opts.institutionId)
    let institutionIds: string[] | null =
      opts.institutionIds !== undefined
        ? opts.institutionIds
        : scope.allowed && !scope.isSuper
          ? scope.institutionIds
          : null
    if (filterInstitutionId) {
      institutionIds = [filterInstitutionId]
    }
    return buildApprovalsSnapshot(db, {
      range: opts.range,
      institutionIds,
      institutionId: filterInstitutionId,
      courseId,
    })
  }

  // Admin / superadmin (and teaching roles opening admin pack)
  if (role === 'admin' || role === 'superadmin' || prefer === 'admin' || prefer === 'superadmin') {
    const audience: 'admin' | 'superadmin' =
      role === 'superadmin' || prefer === 'superadmin' ? 'superadmin' : 'admin'
    return buildReportSnapshot(db, {
      audience,
      range: opts.range,
      institutionIds: opts.institutionIds ?? null,
      courseId,
      institutionId: filterInstitutionId,
    })
  }

  // Fallback: instructors/admins/RP who teach
  if (['instructor', 'admin', 'resource_person', 'superadmin'].includes(role)) {
    return buildTeachSnapshot(db, {
      userId: opts.userId,
      range: opts.range,
      courseId,
      institutionId: filterInstitutionId,
      enrollmentStatus,
    })
  }

  return buildStudentSnapshot(db, { userId: opts.userId, range: opts.range })
}
