import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReportBlock } from '@/lib/reports/types'
import { computePresenceSnapshot } from '@/lib/admin/presence'

type Db = SupabaseClient<any>

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

export async function computeApprovalsReports(
  db: Db,
  options?: { institutionIds?: string[] | null }
): Promise<ReportBlock[]> {
  let regQuery = db
    .from('student_registrations')
    .select(
      'id, user_id, institution_id, registration_status, submitted_at, reviewed_at, reviewed_by, rejection_reason'
    )
    .order('submitted_at', { ascending: false })
    .limit(2000)

  if (options?.institutionIds?.length) {
    regQuery = regQuery.in('institution_id', options.institutionIds)
  }

  const { data: registrations } = await regQuery
  const regs = (registrations || []) as any[]

  const decided = regs.filter((r) => r.reviewed_at && r.submitted_at)
  const decisionHours = decided
    .map((r) => {
      const ms = new Date(r.reviewed_at).getTime() - new Date(r.submitted_at).getTime()
      return Math.max(0, ms / (1000 * 60 * 60))
    })
    .sort((a, b) => a - b)

  const pending = regs.filter((r) =>
    ['submitted', 'under_review', 'additional_info_requested', 'waitlisted'].includes(
      r.registration_status
    )
  )
  const medianH = decisionHours.length
    ? decisionHours[Math.floor(decisionHours.length / 2)]
    : 0
  const p95H = percentile(decisionHours, 95)

  const rejectionReasons: Record<string, number> = {}
  for (const r of regs.filter((x) => x.registration_status === 'rejected')) {
    const reason = (r.rejection_reason || 'Unspecified').trim() || 'Unspecified'
    rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1
  }

  const byReviewer: Record<string, { decided: number; pending: number }> = {}
  for (const r of regs) {
    if (r.reviewed_by) {
      if (!byReviewer[r.reviewed_by]) byReviewer[r.reviewed_by] = { decided: 0, pending: 0 }
      byReviewer[r.reviewed_by].decided += 1
    }
  }

  const reviewerIds = Object.keys(byReviewer)
  const { data: reviewerProfiles } = reviewerIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', reviewerIds)
    : { data: [] }
  const reviewerName = new Map(
    ((reviewerProfiles || []) as any[]).map((p) => [p.id, p.full_name || p.email])
  )

  const approved = regs.filter((r) => r.registration_status === 'approved')
  const approvedUserIds = [...new Set(approved.map((r) => r.user_id).filter(Boolean))]
  let enrollments: any[] = []
  let progress: any[] = []
  if (approvedUserIds.length) {
    const [{ data: ens }, { data: lp }] = await Promise.all([
      db
        .from('enrollments')
        .select('user_id, enrolled_at')
        .in('user_id', approvedUserIds.slice(0, 500)),
      db
        .from('lesson_progress')
        .select('user_id, last_accessed_at, completed_at')
        .in('user_id', approvedUserIds.slice(0, 500))
        .limit(5000),
    ])
    enrollments = (ens || []) as any[]
    progress = (lp || []) as any[]
  }
  const enrolledUsers = new Set(enrollments.map((e) => e.user_id))
  const progressedUsers = new Set(progress.map((p) => p.user_id))
  const neverEnrolled = approved.filter((r) => r.user_id && !enrolledUsers.has(r.user_id))
  const neverOpened = approved.filter(
    (r) => r.user_id && enrolledUsers.has(r.user_id) && !progressedUsers.has(r.user_id)
  )

  // Approval → first lesson latency
  const firstProgressByUser = new Map<string, string>()
  for (const p of progress) {
    const t = p.completed_at || p.last_accessed_at
    if (!t) continue
    const prev = firstProgressByUser.get(p.user_id)
    if (!prev || t < prev) firstProgressByUser.set(p.user_id, t)
  }
  const latenciesH: number[] = []
  for (const r of approved) {
    if (!r.user_id || !r.reviewed_at) continue
    const first = firstProgressByUser.get(r.user_id)
    if (!first) continue
    const h = (new Date(first).getTime() - new Date(r.reviewed_at).getTime()) / (1000 * 60 * 60)
    if (h >= 0) latenciesH.push(h)
  }
  latenciesH.sort((a, b) => a - b)

  // Institution coverage
  const { data: institutions } = await db
    .from('institutions')
    .select('id, name, is_active')
    .eq('is_active', true)
  const instList = (institutions || []) as any[]
  const scopedInst = options?.institutionIds?.length
    ? instList.filter((i) => options.institutionIds!.includes(i.id))
    : instList

  const [{ data: access }, { data: courses }] = await Promise.all([
    db
      .from('institution_access')
      .select('institution_id, role_within_institution, is_active')
      .eq('is_active', true),
    db.from('courses').select('id, instructor_id, is_published'),
  ])
  const teachersByInst: Record<string, number> = {}
  const studentsByInst: Record<string, number> = {}
  for (const a of (access || []) as any[]) {
    if (a.role_within_institution === 'teacher' || a.role_within_institution === 'resource_person') {
      teachersByInst[a.institution_id] = (teachersByInst[a.institution_id] || 0) + 1
    }
    if (a.role_within_institution === 'student') {
      studentsByInst[a.institution_id] = (studentsByInst[a.institution_id] || 0) + 1
    }
  }

  return [
    {
      id: 'approval-queue-aging',
      title: 'Approval queue aging',
      metrics: [
        { key: 'pending', label: 'Open backlog', value: pending.length },
        { key: 'median', label: 'Median decision (h)', value: Math.round(medianH) },
        { key: 'p95', label: 'P95 decision (h)', value: Math.round(p95H) },
        { key: 'decided', label: 'Decided (sample)', value: decided.length },
      ],
      columns: [
        { key: 'status', label: 'Status' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'ageHours', label: 'Age (h)' },
      ],
      rows: pending.slice(0, 40).map((r) => {
        const submitted = r.submitted_at
        const age = submitted
          ? Math.round((Date.now() - new Date(submitted).getTime()) / (1000 * 60 * 60))
          : 0
        return {
          id: r.id,
          cells: {
            status: r.registration_status,
            submitted: submitted ? new Date(submitted).toLocaleDateString() : '—',
            ageHours: age,
          },
        }
      }),
      emptyMessage: 'No pending registrations.',
    },
    {
      id: 'rejection-reasons',
      title: 'Rejection reasons',
      columns: [
        { key: 'reason', label: 'Reason' },
        { key: 'count', label: 'Count' },
      ],
      rows: Object.entries(rejectionReasons)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({
          id: reason,
          cells: { reason, count },
        })),
      emptyMessage: 'No rejections in sample.',
    },
    {
      id: 'reviewer-workload',
      title: 'Reviewer workload',
      columns: [
        { key: 'reviewer', label: 'Reviewer' },
        { key: 'decided', label: 'Decisions' },
      ],
      rows: Object.entries(byReviewer).map(([id, stats]) => ({
        id,
        cells: {
          reviewer: reviewerName.get(id) || id.slice(0, 8),
          decided: stats.decided,
        },
      })),
      emptyMessage: 'No reviewer activity yet.',
    },
    {
      id: 'post-approval-activation',
      title: 'Post-approval activation',
      metrics: [
        { key: 'approved', label: 'Approved (sample)', value: approved.length },
        { key: 'neverEnroll', label: 'Never enrolled', value: neverEnrolled.length },
        { key: 'neverOpen', label: 'Enrolled, no lesson', value: neverOpened.length },
      ],
    },
    {
      id: 'approval-first-lesson-latency',
      title: 'Approval → first lesson latency',
      metrics: [
        {
          key: 'n',
          label: 'Sample with progress',
          value: latenciesH.length,
        },
        {
          key: 'median',
          label: 'Median hours',
          value: latenciesH.length ? Math.round(latenciesH[Math.floor(latenciesH.length / 2)]) : '—',
        },
        {
          key: 'p95',
          label: 'P95 hours',
          value: latenciesH.length ? Math.round(percentile(latenciesH, 95)) : '—',
        },
      ],
    },
    {
      id: 'institution-coverage',
      title: 'Institution coverage',
      description: 'Active institutions missing teachers or students.',
      columns: [
        { key: 'institution', label: 'Institution' },
        { key: 'teachers', label: 'Teachers' },
        { key: 'students', label: 'Students' },
      ],
      rows: scopedInst.map((i) => ({
        id: i.id,
        cells: {
          institution: i.name,
          teachers: teachersByInst[i.id] || 0,
          students: studentsByInst[i.id] || 0,
        },
      })),
      emptyMessage: 'No institutions.',
    },
  ]
}

export async function computeAdminOpsReports(db: Db): Promise<ReportBlock[]> {
  const since30 = daysAgo(30)
  const since7 = daysAgo(7)

  const [
    { data: profiles },
    { data: courses },
    { data: enrollments },
    { data: institutions },
    { data: modules },
    { data: lessons },
    { data: courseInstitutions },
    { data: institutionAccess },
    { data: registrations },
    { data: certificates },
    { data: courseInstructors },
    { data: activitySubmissions },
  ] = await Promise.all([
    db.from('profiles').select('id, role, institution_id, created_at, account_status'),
    db.from('courses').select('id, title, instructor_id, is_published, created_at, updated_at'),
    db
      .from('enrollments')
      .select('id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at, enrolled_at'),
    db.from('institutions').select('id, name, is_active'),
    db.from('modules').select('id, course_id'),
    db.from('lessons').select('id, module_id').limit(8000),
    db.from('course_institutions').select('course_id, institution_id'),
    db.from('institution_access').select('institution_id, user_id, role_within_institution, is_active'),
    db
      .from('student_registrations')
      .select('id, user_id, institution_id, registration_status, submitted_at, reviewed_at')
      .limit(3000),
    db.from('certificates').select('id, course_id, user_id'),
    db.from('course_instructors').select('course_id, user_id, role'),
    db
      .from('lesson_activity_progress')
      .select('id, lesson_id, status, grade, source, completed')
      .in('source', ['submission', 'response'])
      .limit(8000),
  ])

  const profileList = (profiles || []) as any[]
  const courseList = (courses || []) as any[]
  const enrollmentList = (enrollments || []) as any[]
  const instList = (institutions || []) as any[]
  const moduleList = (modules || []) as any[]
  const lessonList = (lessons || []) as any[]
  const ciList = (courseInstitutions || []) as any[]
  const accessList = ((institutionAccess || []) as any[]).filter((a) => a.is_active)
  const regList = (registrations || []) as any[]
  const activityList = (activitySubmissions || []) as any[]

  const published = courseList.filter((c) => c.is_published)
  const draft = courseList.filter((c) => !c.is_published)
  const dauProxy = new Set(
    enrollmentList
      .filter((e) => e.last_accessed_at && e.last_accessed_at >= daysAgo(1))
      .map((e) => e.user_id)
  ).size
  const wauProxy = new Set(
    enrollmentList
      .filter((e) => e.last_accessed_at && e.last_accessed_at >= since7)
      .map((e) => e.user_id)
  ).size
  const mauProxy = new Set(
    enrollmentList
      .filter((e) => e.last_accessed_at && e.last_accessed_at >= since30)
      .map((e) => e.user_id)
  ).size

  const modulesByCourse: Record<string, number> = {}
  for (const m of moduleList) {
    modulesByCourse[m.course_id] = (modulesByCourse[m.course_id] || 0) + 1
  }
  const emptyCourses = published.filter((c) => (modulesByCourse[c.id] || 0) === 0)

  const ensByCourse: Record<string, number> = {}
  for (const e of enrollmentList) {
    ensByCourse[e.course_id] = (ensByCourse[e.course_id] || 0) + 1
  }

  const ensByInst: Record<string, number> = {}
  const profileInst = new Map(profileList.map((p) => [p.id, p.institution_id]))
  for (const e of enrollmentList) {
    const iid = profileInst.get(e.user_id)
    if (iid) ensByInst[iid] = (ensByInst[iid] || 0) + 1
  }

  // Audience coverage
  const restrictedCourseIds = new Set(ciList.map((r) => r.course_id))
  const institutionsForCourse: Record<string, string[]> = {}
  for (const row of ciList) {
    if (!institutionsForCourse[row.course_id]) institutionsForCourse[row.course_id] = []
    institutionsForCourse[row.course_id].push(row.institution_id)
  }

  const eligibleByInst: Record<string, number> = {}
  for (const a of accessList) {
    if (a.role_within_institution === 'student') {
      eligibleByInst[a.institution_id] = (eligibleByInst[a.institution_id] || 0) + 1
    }
  }

  const darkCatalog = published
    .filter((c) => {
      const ageOk = c.created_at && c.created_at < since30
      const lowEnroll = (ensByCourse[c.id] || 0) <= 1
      return ageOk && lowEnroll
    })
    .slice(0, 40)

  const audienceMisfit = [...restrictedCourseIds]
    .map((courseId) => {
      const course = courseList.find((c) => c.id === courseId)
      if (!course?.is_published) return null
      const instIds = institutionsForCourse[courseId] || []
      const eligible = instIds.reduce((s, id) => s + (eligibleByInst[id] || 0), 0)
      const ens = ensByCourse[courseId] || 0
      if (eligible > 0 && ens === 0) {
        return {
          id: courseId,
          cells: {
            course: course.title,
            institutions: instIds.length,
            eligibleStudents: eligible,
            enrollments: ens,
          },
        }
      }
      return null
    })
    .filter(Boolean) as { id: string; cells: Record<string, string | number> }[]

  // Funnel
  const submitted = regList.filter((r) => r.submitted_at || r.registration_status !== 'draft').length
  const approvedRegs = regList.filter((r) => r.registration_status === 'approved').length
  const rejectedRegs = regList.filter((r) => r.registration_status === 'rejected').length
  const firstEnrollUsers = new Set(enrollmentList.map((e) => e.user_id))
  const approvedThenEnrolled = regList.filter(
    (r) => r.registration_status === 'approved' && r.user_id && firstEnrollUsers.has(r.user_id)
  ).length

  const completions = enrollmentList.filter((e) => e.completed_at || e.status === 'completed').length
  const completionRate =
    enrollmentList.length > 0 ? Math.round((completions / enrollmentList.length) * 100) : 0

  const staffByCourse: Record<string, number> = {}
  for (const s of (courseInstructors || []) as any[]) {
    staffByCourse[s.course_id] = (staffByCourse[s.course_id] || 0) + 1
  }
  const quietCourses = published.filter((c) => {
    const hasRecent = enrollmentList.some(
      (e) => e.course_id === c.id && e.last_accessed_at && e.last_accessed_at >= since30
    )
    return !hasRecent && (ensByCourse[c.id] || 0) > 0
  })

  const moduleCourse = new Map(moduleList.map((m) => [m.id, m.course_id]))
  const lessonCourse = new Map(
    lessonList
      .map((l) => [l.id, moduleCourse.get(l.module_id)] as const)
      .filter(([, cid]) => Boolean(cid))
  )
  const courseTitleMap = new Map(courseList.map((c) => [c.id, c.title]))
  const pendingByCourse: Record<string, number> = {}
  const gradedByCourse: Record<string, number> = {}
  const submittedByCourse: Record<string, number> = {}
  for (const row of activityList) {
    const courseId = lessonCourse.get(row.lesson_id)
    if (!courseId) continue
    submittedByCourse[courseId] = (submittedByCourse[courseId] || 0) + 1
    if (row.status === 'graded' || row.status === 'returned') {
      gradedByCourse[courseId] = (gradedByCourse[courseId] || 0) + 1
    } else {
      pendingByCourse[courseId] = (pendingByCourse[courseId] || 0) + 1
    }
  }
  const totalActivitySubmitted = activityList.length
  const totalActivityPending = Object.values(pendingByCourse).reduce((s, n) => s + n, 0)
  const totalActivityGraded = Object.values(gradedByCourse).reduce((s, n) => s + n, 0)
  const platformGradedRate =
    totalActivitySubmitted > 0
      ? Math.round((totalActivityGraded / totalActivitySubmitted) * 100)
      : 0
  const assessedCourseRows = Object.keys(submittedByCourse)
    .map((courseId) => ({
      id: courseId,
      cells: {
        course: courseTitleMap.get(courseId) || courseId,
        submitted: submittedByCourse[courseId] || 0,
        pending: pendingByCourse[courseId] || 0,
        graded: gradedByCourse[courseId] || 0,
        gradedRate:
          submittedByCourse[courseId] > 0
            ? `${Math.round(
                ((gradedByCourse[courseId] || 0) / submittedByCourse[courseId]) * 100
              )}%`
            : '—',
      },
    }))
    .sort((a, b) => Number(b.cells.pending) - Number(a.cells.pending))
    .slice(0, 40)

  const instName = new Map(instList.map((i) => [i.id, i.name]))

  return [
    {
      id: 'adoption',
      title: 'Adoption',
      metrics: [
        { key: 'profiles', label: 'Profiles', value: profileList.length },
        { key: 'dau', label: 'Active learners (1d)*', value: dauProxy, hint: 'Based on enrollment last_accessed_at' },
        { key: 'wau', label: 'Active learners (7d)*', value: wauProxy },
        { key: 'mau', label: 'Active learners (30d)*', value: mauProxy },
        { key: 'published', label: 'Published courses', value: published.length },
        { key: 'draft', label: 'Draft courses', value: draft.length },
        { key: 'enrollments', label: 'Enrollments', value: enrollmentList.length },
      ],
      columns: [
        { key: 'institution', label: 'Institution' },
        { key: 'enrollments', label: 'Enrollments' },
      ],
      rows: Object.entries(ensByInst)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({
          id,
          cells: { institution: instName.get(id) || id, enrollments: count },
        })),
    },
    {
      id: 'catalog-health',
      title: 'Catalog health',
      metrics: [
        { key: 'empty', label: 'Published with 0 modules', value: emptyCourses.length },
        { key: 'restricted', label: 'Audience-restricted courses', value: restrictedCourseIds.size },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'issue', label: 'Issue' },
      ],
      rows: emptyCourses.slice(0, 30).map((c) => ({
        id: c.id,
        cells: { course: c.title, issue: 'No modules' },
      })),
      emptyMessage: 'No empty published courses.',
    },
    {
      id: 'access-audience',
      title: 'Access & audience',
      metrics: [
        { key: 'links', label: 'course_institutions rows', value: ciList.length },
        { key: 'access', label: 'Active institution_access', value: accessList.length },
        {
          key: 'open',
          label: 'Open (no audience lock)',
          value: courseList.length - restrictedCourseIds.size,
        },
      ],
    },
    {
      id: 'learning-outcomes',
      title: 'Learning outcomes',
      metrics: [
        { key: 'completionRate', label: 'Completion rate', value: `${completionRate}%` },
        { key: 'completions', label: 'Completions', value: completions },
        { key: 'certs', label: 'Certificates', value: (certificates || []).length },
      ],
    },
    {
      id: 'assessed-results',
      title: 'Assessed results',
      description: 'Activity and assignment submission grading across courses.',
      metrics: [
        { key: 'submitted', label: 'Activity submissions', value: totalActivitySubmitted },
        { key: 'pending', label: 'Pending grading', value: totalActivityPending },
        { key: 'graded', label: 'Graded', value: totalActivityGraded },
        { key: 'gradedRate', label: 'Graded rate', value: `${platformGradedRate}%` },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'pending', label: 'Pending' },
        { key: 'graded', label: 'Graded' },
        { key: 'gradedRate', label: 'Graded rate' },
      ],
      rows: assessedCourseRows,
      emptyMessage: 'No assessed activity submissions yet.',
    },
    {
      id: 'registration-funnel',
      title: 'Registration funnel',
      metrics: [
        { key: 'submitted', label: 'Submitted / in pipeline', value: submitted },
        { key: 'approved', label: 'Approved', value: approvedRegs },
        { key: 'rejected', label: 'Rejected', value: rejectedRegs },
        { key: 'enrolled', label: 'Approved → enrolled', value: approvedThenEnrolled },
      ],
    },
    {
      id: 'instructor-health',
      title: 'Instructor health',
      metrics: [
        {
          key: 'solo',
          label: 'Published with no co-teachers',
          value: published.filter((c) => (staffByCourse[c.id] || 0) === 0).length,
        },
        { key: 'quiet', label: 'Published with enrollments but no 30d activity', value: quietCourses.length },
      ],
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'enrollments', label: 'Enrollments' },
      ],
      rows: quietCourses.slice(0, 25).map((c) => ({
        id: c.id,
        cells: { course: c.title, enrollments: ensByCourse[c.id] || 0 },
      })),
      emptyMessage: 'No quiet courses detected.',
    },
    {
      id: 'dark-catalog',
      title: 'Dark Catalog Index',
      description: 'Published 30+ days with ≤1 enrollment.',
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'enrollments', label: 'Enrollments' },
        { key: 'created', label: 'Created' },
      ],
      rows: darkCatalog.map((c) => ({
        id: c.id,
        cells: {
          course: c.title,
          enrollments: ensByCourse[c.id] || 0,
          created: c.created_at ? new Date(c.created_at).toLocaleDateString() : '—',
        },
      })),
      emptyMessage: 'No dark-catalog courses.',
    },
    {
      id: 'audience-lock-misfit',
      title: 'Audience Lock Misfit',
      description: 'Restricted courses with eligible institution students but 0 enrollments.',
      columns: [
        { key: 'course', label: 'Course' },
        { key: 'institutions', label: 'Target institutions' },
        { key: 'eligibleStudents', label: 'Eligible students' },
        { key: 'enrollments', label: 'Enrollments' },
      ],
      rows: audienceMisfit,
      emptyMessage: 'No audience-lock misfits detected.',
    },
  ]
}

export async function computePlatformCommandReports(db: Db): Promise<ReportBlock[]> {
  let livePresence: ReportBlock | null = null
  try {
    const snap = await computePresenceSnapshot(db)
    livePresence = {
      id: 'live-presence',
      title: 'Live presence',
      description: 'Heartbeat sessions. The roster on this page updates in real time.',
      metrics: [
        { key: 'now', label: 'Active now', value: snap.counts.now },
        { key: 'today', label: 'Active today', value: snap.counts.today },
        {
          key: 'nowRoles',
          label: 'Now by role',
          value:
            Object.entries(snap.counts.nowByRole)
              .map(([role, n]) => `${role}:${n}`)
              .join(', ') || '—',
        },
      ],
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'where', label: 'Location' },
        { key: 'state', label: 'State' },
      ],
      rows: snap.activeToday.slice(0, 40).map((p) => ({
        id: p.userId,
        cells: {
          name: p.fullName,
          role: p.role,
          where: p.pathLabel,
          state: p.live ? 'Active now' : 'Earlier today',
        },
      })),
      emptyMessage: 'No presence heartbeats yet today.',
    }
  } catch {
    livePresence = null
  }

  const [
    { data: institutions },
    { data: profiles },
    { data: courses },
    { data: enrollments },
    { data: quizzes },
    { data: decks },
    { data: forums },
    { data: certificates },
    { data: interventions },
  ] = await Promise.all([
    db.from('institutions').select('id, name, is_active'),
    db.from('profiles').select('id, role, institution_id'),
    db.from('courses').select('id, title, is_published'),
    db
      .from('enrollments')
      .select('id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at'),
    db.from('quizzes').select('id, lesson_id'),
    db.from('flashcard_decks').select('id, course_id'),
    db.from('forums').select('id, course_id'),
    db.from('certificates').select('id, course_id'),
    db
      .from('teacher_interventions')
      .select('id, course_id, student_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const instList = ((institutions || []) as any[]).filter((i) => i.is_active !== false)
  const profileList = (profiles || []) as any[]
  const enrollmentList = (enrollments || []) as any[]
  const courseList = (courses || []) as any[]
  const publishedIds = new Set(courseList.filter((c) => c.is_published).map((c) => c.id))

  const roleCounts: Record<string, number> = {}
  for (const p of profileList) {
    roleCounts[p.role || 'unknown'] = (roleCounts[p.role || 'unknown'] || 0) + 1
  }

  const crossTenant = instList.map((inst) => {
    const members = profileList.filter((p) => p.institution_id === inst.id).map((p) => p.id)
    const memberSet = new Set(members)
    const ens = enrollmentList.filter((e) => memberSet.has(e.user_id))
    const completed = ens.filter((e) => e.completed_at || e.status === 'completed').length
    const active = ens.filter(
      (e) => e.last_accessed_at && e.last_accessed_at >= daysAgo(14)
    ).length
    return {
      id: inst.id,
      cells: {
        institution: inst.name,
        members: members.length,
        enrollments: ens.length,
        active14d: active,
        completionRate: ens.length ? `${Math.round((completed / ens.length) * 100)}%` : '0%',
      },
    }
  })

  const courseCount = Math.max(publishedIds.size, 1)
  const coursesWithQuiz = new Set(
    // approximate via lessons→modules would be heavy; use decks/forums/certs by course
  )
  void coursesWithQuiz
  const deckCourses = new Set(((decks || []) as any[]).map((d) => d.course_id).filter(Boolean))
  const forumCourses = new Set(((forums || []) as any[]).map((f) => f.course_id).filter(Boolean))
  const certCourses = new Set(((certificates || []) as any[]).map((c) => c.course_id))

  // Intervention effectiveness: progress after intervention within 7d
  const interventionList = (interventions || []) as any[]
  let resumed = 0
  let evaluated = 0
  if (interventionList.length) {
    const studentIds = [...new Set(interventionList.map((i) => i.student_id))]
    const { data: progress } = await db
      .from('lesson_progress')
      .select('user_id, last_accessed_at')
      .in('user_id', studentIds.slice(0, 200))
    const progressList = (progress || []) as any[]
    for (const iv of interventionList.slice(0, 200)) {
      const windowEnd = new Date(iv.created_at)
      windowEnd.setDate(windowEnd.getDate() + 7)
      const hit = progressList.some(
        (p) =>
          p.user_id === iv.student_id &&
          p.last_accessed_at &&
          p.last_accessed_at > iv.created_at &&
          p.last_accessed_at <= windowEnd.toISOString()
      )
      evaluated += 1
      if (hit) resumed += 1
    }
  }

  return [
    ...(livePresence ? [livePresence] : []),
    {
      id: 'cross-tenant',
      title: 'Cross-tenant comparison',
      columns: [
        { key: 'institution', label: 'Institution' },
        { key: 'members', label: 'Members' },
        { key: 'enrollments', label: 'Enrollments' },
        { key: 'active14d', label: 'Active 14d' },
        { key: 'completionRate', label: 'Completion rate' },
      ],
      rows: crossTenant,
    },
    {
      id: 'role-audit',
      title: 'Role & privilege audit',
      columns: [
        { key: 'role', label: 'Role' },
        { key: 'count', label: 'Users' },
      ],
      rows: Object.entries(roleCounts).map(([role, count]) => ({
        id: role,
        cells: { role, count },
      })),
    },
    {
      id: 'feature-adoption',
      title: 'Feature adoption',
      metrics: [
        {
          key: 'flashcards',
          label: 'Courses with flashcards',
          value: `${Math.round((deckCourses.size / courseCount) * 100)}%`,
        },
        {
          key: 'forums',
          label: 'Courses with forums',
          value: `${Math.round((forumCourses.size / courseCount) * 100)}%`,
        },
        {
          key: 'certs',
          label: 'Courses with certificates issued',
          value: `${Math.round((certCourses.size / courseCount) * 100)}%`,
        },
        {
          key: 'quizzes',
          label: 'Quiz objects',
          value: (quizzes || []).length,
          hint: 'Lesson-scoped; % of courses needs join via modules',
        },
      ],
    },
    {
      id: 'intervention-effectiveness',
      title: 'Intervention effectiveness',
      metrics: [
        { key: 'sample', label: 'Interventions evaluated', value: evaluated },
        {
          key: 'resumed',
          label: 'Resumed in 7d',
          value: resumed,
        },
        {
          key: 'rate',
          label: 'Resume rate',
          value: evaluated ? `${Math.round((resumed / evaluated) * 100)}%` : '—',
        },
      ],
      emptyMessage: evaluated === 0 ? 'No interventions to evaluate.' : undefined,
    },
  ]
}
