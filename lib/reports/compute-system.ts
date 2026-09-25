import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReportBlock } from '@/lib/reports/types'
import { instrumentationGapsAsReportRows } from '@/lib/reports/instrumentation-gaps'
import { courseEditHref, learnerHref } from '@/lib/reports/action-links'

type Db = SupabaseClient<any>

export async function computeSystemPulseReports(db: Db): Promise<ReportBlock[]> {
  const [
    { data: enrollments },
    { data: courses },
    { data: lessonProgress },
    { data: lessons },
    { data: modules },
    { data: courseInstitutions },
    { data: profiles },
    { data: invites },
    { data: institutionAccess },
  ] = await Promise.all([
    db.from('enrollments').select('id, user_id, course_id, status, enrolled_at'),
    db.from('courses').select('id, title, instructor_id, is_published, created_at'),
    db.from('lesson_progress').select('id, lesson_id, course_id, user_id'),
    db.from('lessons').select('id, module_id'),
    db.from('modules').select('id, course_id, order_index'),
    db.from('course_institutions').select('course_id, institution_id'),
    db.from('profiles').select('id, role, institution_id, created_at'),
    db.from('enrollment_invites').select('id, course_id, used_at, expires_at, created_at'),
    db
      .from('institution_access')
      .select('user_id, institution_id, is_active, role_within_institution')
      .eq('is_active', true),
  ])

  const enrollmentList = (enrollments || []) as any[]
  const courseList = (courses || []) as any[]
  const progressList = (lessonProgress || []) as any[]
  const lessonList = (lessons || []) as any[]
  const moduleList = (modules || []) as any[]
  const ciList = (courseInstitutions || []) as any[]
  const profileList = (profiles || []) as any[]
  const inviteList = (invites || []) as any[]
  const accessList = (institutionAccess || []) as any[]

  const courseIds = new Set(courseList.map((c) => c.id))
  const lessonIds = new Set(lessonList.map((l) => l.id))
  const profileIds = new Set(profileList.map((p) => p.id))

  const orphanEnrollments = enrollmentList.filter(
    (e) => !courseIds.has(e.course_id) || !profileIds.has(e.user_id)
  )
  const missingInstructor = courseList.filter((c) => !c.instructor_id)
  const progressMissingLesson = progressList.filter((p) => p.lesson_id && !lessonIds.has(p.lesson_id))

  const statusMachine: Record<string, number> = {}
  for (const e of enrollmentList) {
    const s = e.status || 'unknown'
    statusMachine[s] = (statusMachine[s] || 0) + 1
  }
  const unusedInvites = inviteList.filter((i) => !i.used_at)
  const expiredUnused = unusedInvites.filter(
    (i) => i.expires_at && new Date(i.expires_at).getTime() < Date.now()
  )

  // Tenancy leak: restricted course + enrollee whose institution not in audience
  const audienceByCourse: Record<string, Set<string>> = {}
  for (const row of ciList) {
    if (!audienceByCourse[row.course_id]) audienceByCourse[row.course_id] = new Set()
    audienceByCourse[row.course_id].add(row.institution_id)
  }
  const userInst = new Map(profileList.map((p) => [p.id, p.institution_id as string | null]))
  // Staff bypass: instructors / course staff — approximate via instructor_id + course_instructors later
  const instructorByCourse = new Map(courseList.map((c) => [c.id, c.instructor_id]))
  const leaks = enrollmentList.filter((e) => {
    const allowed = audienceByCourse[e.course_id]
    if (!allowed || allowed.size === 0) return false
    if (instructorByCourse.get(e.course_id) === e.user_id) return false
    const iid = userInst.get(e.user_id)
    if (!iid) return true
    return !allowed.has(iid)
  })

  // Path breakage
  const modulesByCourse: Record<string, any[]> = {}
  for (const m of moduleList) {
    if (!modulesByCourse[m.course_id]) modulesByCourse[m.course_id] = []
    modulesByCourse[m.course_id].push(m)
  }
  const lessonsByModule: Record<string, number> = {}
  for (const l of lessonList) {
    lessonsByModule[l.module_id] = (lessonsByModule[l.module_id] || 0) + 1
  }
  const published = courseList.filter((c) => c.is_published)
  const broken = published
    .map((c) => {
      const mods = modulesByCourse[c.id] || []
      if (mods.length === 0) {
        return { id: c.id, href: courseEditHref(c.id), actionLabel: 'Fix course', cells: { course: c.title, issue: 'No modules' } }
      }
      const emptyMods = mods.filter((m) => (lessonsByModule[m.id] || 0) === 0)
      if (emptyMods.length) {
        return {
          id: c.id,
          href: courseEditHref(c.id),
          actionLabel: 'Fix course',
          cells: { course: c.title, issue: `${emptyMods.length} module(s) with 0 lessons` },
        }
      }
      return null
    })
    .filter(Boolean) as {
      id: string
      href?: string
      actionLabel?: string
      cells: Record<string, string | number>
    }[]

  // Teacher time-to-value
  const instructors = profileList.filter((p) =>
    ['instructor', 'admin', 'resource_person', 'superadmin'].includes(p.role)
  )
  const ttvRows: { id: string; cells: Record<string, string | number> }[] = []
  for (const inst of instructors.slice(0, 100)) {
    const owned = courseList
      .filter((c) => c.instructor_id === inst.id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    const firstPublished = owned.find((c) => c.is_published)
    if (!owned.length) continue
    const firstCourse = owned[0]
    const firstEnroll = enrollmentList
      .filter((e) => owned.some((c) => c.id === e.course_id))
      .sort((a, b) => String(a.enrolled_at).localeCompare(String(b.enrolled_at)))[0]
    const created = inst.created_at ? new Date(inst.created_at).getTime() : null
    const toCourse =
      created && firstCourse?.created_at
        ? Math.round(
            (new Date(firstCourse.created_at).getTime() - created) / (1000 * 60 * 60 * 24)
          )
        : null
    const toPublish =
      created && firstPublished?.created_at
        ? Math.round(
            (new Date(firstPublished.created_at).getTime() - created) / (1000 * 60 * 60 * 24)
          )
        : null
    const toEnroll =
      created && firstEnroll?.enrolled_at
        ? Math.round(
            (new Date(firstEnroll.enrolled_at).getTime() - created) / (1000 * 60 * 60 * 24)
          )
        : null
    ttvRows.push({
      id: inst.id,
      cells: {
        instructor: inst.id.slice(0, 8),
        daysToFirstCourse: toCourse ?? '—',
        daysToPublish: toPublish ?? '—',
        daysToFirstEnrollment: toEnroll ?? '—',
      },
    })
  }

  return [
    {
      id: 'data-quality',
      title: 'Data quality debt',
      metrics: [
        { key: 'orphanEnroll', label: 'Orphan enrollments', value: orphanEnrollments.length },
        { key: 'noInstructor', label: 'Courses missing instructor', value: missingInstructor.length },
        {
          key: 'badProgress',
          label: 'Progress rows for missing lessons',
          value: progressMissingLesson.length,
        },
      ],
      columns: [
        { key: 'issue', label: 'Issue' },
        { key: 'count', label: 'Count' },
      ],
      rows: [
        { id: '1', cells: { issue: 'Orphan enrollments', count: orphanEnrollments.length } },
        { id: '2', cells: { issue: 'Courses missing instructor_id', count: missingInstructor.length } },
        {
          id: '3',
          cells: { issue: 'lesson_progress → missing lesson', count: progressMissingLesson.length },
        },
      ],
    },
    {
      id: 'enrollment-state-machine',
      title: 'Enrollment state machine',
      metrics: [
        ...Object.entries(statusMachine).map(([status, count]) => ({
          key: status,
          label: `Enrollment: ${status}`,
          value: count,
        })),
        { key: 'unusedInvites', label: 'Unused invites', value: unusedInvites.length },
        { key: 'expiredUnused', label: 'Expired unused invites', value: expiredUnused.length },
      ],
      emptyMessage:
        'Payments/checkout abandon requires a payments ledger (see Instrumentation gaps).',
    },
    {
      id: 'tenancy-leak',
      title: 'Institution tenancy leak scanner',
      description:
        'Enrollments on audience-restricted courses where the learner institution is not in course_institutions (excludes course owner).',
      metrics: [{ key: 'leaks', label: 'Potential leaks', value: leaks.length }],
      columns: [
        { key: 'enrollment', label: 'Enrollment' },
        { key: 'course', label: 'Course' },
        { key: 'userInstitution', label: 'User institution' },
      ],
      rows: leaks.slice(0, 40).map((e) => ({
        id: e.id,
        href: learnerHref(e.course_id, e.user_id),
        actionLabel: 'Review learner',
        cells: {
          enrollment: e.id.slice(0, 8),
          course: courseList.find((c) => c.id === e.course_id)?.title || e.course_id,
          userInstitution: userInst.get(e.user_id) || 'none',
        },
      })),
      emptyMessage: 'No tenancy leaks detected in current data.',
    },
    {
      id: 'path-breakage',
      title: 'Learning path breakage',
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'issue', label: 'Issue' },
      ],
      rows: broken.slice(0, 40),
      emptyMessage: 'No path breakage in published courses.',
    },
    {
      id: 'teacher-time-to-value',
      title: 'Teacher time-to-value',
      description: 'Days from profile create → first course → publish → first enrollment.',
      columns: [
        { key: 'instructor', label: 'Instructor' },
        { key: 'daysToFirstCourse', label: 'Days to first course' },
        { key: 'daysToPublish', label: 'Days to publish' },
        { key: 'daysToFirstEnrollment', label: 'Days to first enrollment' },
      ],
      rows: ttvRows.slice(0, 40),
      emptyMessage: 'Not enough instructor activity to compute.',
    },
    {
      id: 'instrumentation-gaps',
      title: 'Instrumentation gaps',
      description: 'Telemetry and ledger work needed for fuller System Pulse.',
      columns: [
        { key: 'area', label: 'Area' },
        { key: 'severity', label: 'Severity' },
        { key: 'status', label: 'Status' },
        { key: 'blocks', label: 'Blocks' },
        { key: 'recommendation', label: 'Recommendation' },
      ],
      rows: instrumentationGapsAsReportRows(),
    },
  ]
}
