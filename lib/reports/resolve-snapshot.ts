import type { SupabaseClient } from '@supabase/supabase-js'
import { getApprovalScope } from '@/lib/approvals-access'
import { buildReportSnapshot } from '@/lib/reports/compute-executive'
import {
  buildApprovalsSnapshot,
  buildStudentSnapshot,
  buildTeachSnapshot,
} from '@/lib/reports/compute-role-snapshots'
import type { ReportRange, ReportSnapshot, SnapshotAudience } from '@/lib/reports/types'

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
  }
): Promise<ReportSnapshot> {
  const prefer = opts.prefer
  const role = opts.role

  if (prefer === 'instructor' || (role === 'instructor' && !prefer)) {
    return buildTeachSnapshot(db, { userId: opts.userId, range: opts.range })
  }

  if (prefer === 'student' || role === 'student') {
    return buildStudentSnapshot(db, { userId: opts.userId, range: opts.range })
  }

  if (prefer === 'resource_person' || (role === 'resource_person' && prefer !== 'instructor')) {
    const scope = await getApprovalScope(db, opts.userId, role, opts.institutionId)
    return buildApprovalsSnapshot(db, {
      range: opts.range,
      institutionIds: scope.allowed && !scope.isSuper ? scope.institutionIds : null,
    })
  }

  // Admin / superadmin (and teaching roles opening admin pack)
  if (role === 'admin' || role === 'superadmin' || prefer === 'admin' || prefer === 'superadmin') {
    const audience: 'admin' | 'superadmin' =
      role === 'superadmin' || prefer === 'superadmin' ? 'superadmin' : 'admin'
    return buildReportSnapshot(db, {
      audience,
      range: opts.range,
      institutionIds: null,
    })
  }

  // Fallback: instructors/admins/RP who teach
  if (['instructor', 'admin', 'resource_person', 'superadmin'].includes(role)) {
    return buildTeachSnapshot(db, { userId: opts.userId, range: opts.range })
  }

  return buildStudentSnapshot(db, { userId: opts.userId, range: opts.range })
}
