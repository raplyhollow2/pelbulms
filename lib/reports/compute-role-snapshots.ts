import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTeachReports, courseIdsForTeacher } from '@/lib/reports/compute-teach'
import { computeStudentReports } from '@/lib/reports/compute-student'
import { computeApprovalsReports } from '@/lib/reports/compute-admin'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'
import type {
  FunnelStep,
  ReportAction,
  ReportAlert,
  ReportMetric,
  ReportRange,
  ReportSeries,
  ReportSnapshot,
  ReportSectionPayload,
} from '@/lib/reports/types'
import { rangeToDays } from '@/lib/reports/types'
import { lessonHref } from '@/lib/reports/action-links'
import { computeLearnerDemographics } from '@/lib/reports/demographics'

type Db = SupabaseClient<any>

function daysAgoIso(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function weekBuckets(days: number): string[] {
  const weeks: string[] = []
  const count = Math.max(1, Math.ceil(days / 7))
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    weeks.push(d.toISOString().slice(0, 10))
  }
  return weeks
}

function bucketByWeek(isoDates: string[], days: number): ReportSeries['points'] {
  const labels = weekBuckets(days)
  const counts = Object.fromEntries(labels.map((l) => [l, 0]))
  for (const iso of isoDates) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    let best = labels[0]
    for (const label of labels) {
      if (t >= new Date(label).getTime()) best = label
    }
    if (counts[best] != null) counts[best] += 1
  }
  return labels.map((date) => ({ date, value: counts[date] || 0 }))
}

function hashSnapshot(payload: Omit<ReportSnapshot, 'hash'>): string {
  const raw = JSON.stringify({
    range: payload.range,
    audience: payload.audience,
    kpis: payload.kpis,
    funnel: payload.funnel,
    alerts: payload.alerts.map((a) => a.id),
    actions: payload.actions.map((a) => a.id),
  })
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export async function buildTeachSnapshot(
  db: Db,
  opts: { userId: string; range: ReportRange; allCourses?: boolean; instructorId?: string | null }
): Promise<ReportSnapshot> {
  const days = rangeToDays(opts.range)
  const since = daysAgoIso(days)
  const since14 = daysAgoIso(14)
  const scope = { allCourses: opts.allCourses, instructorId: opts.instructorId }
  const { blocks, frictionMap } = await computeTeachReports(db, opts.userId, {
    range: opts.range,
    ...scope,
  })
  const courseIds = await courseIdsForTeacher(db, opts.userId, scope)

  const sections: ReportSectionPayload[] = [
    {
      section: 'course-insights',
      title: REPORT_SECTIONS['course-insights'].title,
      description: REPORT_SECTIONS['course-insights'].description,
      blocks,
    },
  ]

  let enrollmentList: any[] = []
  let courseList: any[] = []
  if (courseIds.length) {
    const [{ data: ens }, { data: courses }] = await Promise.all([
      db
        .from('enrollments')
        .select(
          'id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at, enrolled_at'
        )
        .in('course_id', courseIds),
      db.from('courses').select('id, title, is_published').in('id', courseIds),
    ])
    enrollmentList = (ens || []) as any[]
    courseList = (courses || []) as any[]
  }

  const engagement = blocks.find((b) => b.id === 'engagement')
  const atRisk = blocks.find((b) => b.id === 'at-risk')
  const friction = blocks.find((b) => b.id === 'lesson-friction')
  const outcomes = blocks.find((b) => b.id === 'outcomes')

  const active7 = enrollmentList.filter(
    (e) => e.last_accessed_at && e.last_accessed_at >= daysAgoIso(7)
  ).length
  const completions = enrollmentList.filter(
    (e) => e.completed_at || e.status === 'completed'
  ).length
  const atRiskCount = atRisk?.rows?.length ?? 0
  const frictionCount = frictionMap.hotspots.length || friction?.rows?.length || 0
  const topDropOff = frictionMap.hotspots.filter((h) => h.dropOffPct >= 20).length

  const kpis: ReportMetric[] = [
    { key: 'courses', label: 'Your courses', value: courseList.length },
    { key: 'students', label: 'Enrollments', value: enrollmentList.length },
    { key: 'active7', label: 'Active (7d)', value: active7 },
    { key: 'atRisk', label: 'At-risk learners', value: atRiskCount },
    { key: 'completions', label: 'Completions', value: completions },
    {
      key: 'engagement',
      label: 'Engagement (14d)',
      value: engagement?.metrics?.find((m) => m.key === 'rate')?.value ?? '—',
    },
    {
      key: 'pendingGrades',
      label: 'Pending grades',
      value: blocks.find((b) => b.id === 'grading-queue')?.metrics?.find((m) => m.key === 'pending')?.value ?? 0,
    },
  ]

  const series: ReportSeries[] = [
    {
      key: 'enrollments',
      label: 'New enrollments',
      points: bucketByWeek(
        enrollmentList.filter((e) => e.enrolled_at && e.enrolled_at >= since).map((e) => e.enrolled_at),
        days
      ),
    },
    {
      key: 'completions',
      label: 'Completions',
      points: bucketByWeek(
        enrollmentList
          .filter((e) => e.completed_at && e.completed_at >= since)
          .map((e) => e.completed_at),
        days
      ),
    },
  ]

  const funnel: FunnelStep[] = [
    { key: 'enrolled', label: 'Enrolled', count: enrollmentList.length },
    {
      key: 'active14',
      label: 'Active 14d',
      count: enrollmentList.filter(
        (e) => e.last_accessed_at && e.last_accessed_at >= since14
      ).length,
    },
    {
      key: 'progress50',
      label: '≥50% progress',
      count: enrollmentList.filter((e) => (e.progress_percentage || 0) >= 50).length,
    },
    { key: 'completed', label: 'Completed', count: completions },
  ]

  const alerts: ReportAlert[] = []
  const actions: ReportAction[] = []
  let prio = 1

  // Prefer deep links into the course with the most at-risk enrollments
  const since14Iso = since14
  const progressByCourse: Record<string, number[]> = {}
  for (const e of enrollmentList) {
    if (!progressByCourse[e.course_id]) progressByCourse[e.course_id] = []
    progressByCourse[e.course_id].push(e.progress_percentage || 0)
  }
  const medianOf = (arr: number[]) => {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
  }
  const cohortMed = Object.fromEntries(
    Object.entries(progressByCourse).map(([id, vals]) => [id, medianOf(vals)])
  )
  const atRiskEnrollments = enrollmentList.filter((e) => {
    const inactive = !e.last_accessed_at || e.last_accessed_at < since14Iso
    const lag =
      (e.progress_percentage || 0) < Math.max(0, (cohortMed[e.course_id] || 0) - 20)
    return e.status === 'active' && !e.completed_at && (inactive || lag)
  })
  const atRiskByCourse: Record<string, number> = {}
  for (const e of atRiskEnrollments) {
    atRiskByCourse[e.course_id] = (atRiskByCourse[e.course_id] || 0) + 1
  }
  const topAtRiskCourseId = Object.entries(atRiskByCourse).sort((a, b) => b[1] - a[1])[0]?.[0]
  const atRiskHref = topAtRiskCourseId
    ? `/teach/courses/${topAtRiskCourseId}/students`
    : '/teach/reports?focus=at-risk'

  const topHotspot = frictionMap.hotspots[0]
  const frictionHref = topHotspot
    ? lessonHref(topHotspot.courseId, topHotspot.lessonId)
    : '/teach/reports?focus=lesson-friction'
  const atRiskFocusHref = atRiskHref

  if (atRiskCount > 0) {
    alerts.push({
      id: 'at-risk',
      severity: 'critical',
      title: `${atRiskCount} at-risk learners`,
      detail: 'Inactive 14+ days or lagging cohort progress.',
      href: atRiskFocusHref,
    })
    actions.push({
      id: 'act-risk',
      priority: prio++,
      title: 'Reach out to at-risk learners',
      reason: `${atRiskCount} students need intervention`,
      href: atRiskHref,
    })
  }
  if (frictionCount > 0) {
    alerts.push({
      id: 'friction',
      severity: 'watch',
      title: `${frictionCount} high-friction lessons`,
      detail: 'Drop-off, hesitation, stuck mid-lesson, or assessment fail signals.',
      href: frictionHref,
    })
    actions.push({
      id: 'act-friction',
      priority: prio++,
      title: 'Review lesson friction map',
      reason:
        topDropOff > 0
          ? `${topDropOff} lessons with ≥20% drop-off — fix top 3 first`
          : `${frictionCount} hotspots (stuck/dwell/assessment) need review`,
      href: frictionHref,
    })
  }
  const gradingBlock = blocks.find((b) => b.id === 'grading-queue')
  const gradingRows = [...(gradingBlock?.rows || [])].sort(
    (a, b) => Number(b.cells.pending) - Number(a.cells.pending)
  )
  const topGrade = gradingRows[0]
  const pendingGrades = Number(topGrade?.cells.pending || 0)
  const pendingTotal = Number(
    gradingBlock?.metrics?.find((m) => m.key === 'pending')?.value || 0
  )
  if (pendingTotal > 0 && topGrade) {
    const gradeHref = topGrade.href || `/teach/courses/${topGrade.id}/grading`
    alerts.push({
      id: 'grading-backlog',
      severity: 'watch',
      title: `${pendingTotal} submissions waiting`,
      detail: `${topGrade.cells.course} has the largest grading backlog.`,
      href: gradeHref,
    })
    actions.push({
      id: 'act-grade',
      priority: prio++,
      title: `Grade ${topGrade.cells.course}`,
      reason: `${pendingGrades} submissions waiting in the largest queue`,
      href: gradeHref,
    })
    const pendingKpi = kpis.find((k) => k.key === 'pendingGrades')
    if (pendingKpi) pendingKpi.href = gradeHref
  }
  const atRiskKpi = kpis.find((k) => k.key === 'atRisk')
  if (atRiskKpi && atRiskCount > 0) atRiskKpi.href = atRiskHref
  if (actions.length === 0) {
    actions.push({
      id: 'act-ok',
      priority: 1,
      title: 'Courses look healthy',
      reason: 'No critical at-risk or friction signals in this window.',
      href: '/teach/dashboard',
    })
  }

  const learnerIds = [...new Set(enrollmentList.map((e) => e.user_id).filter(Boolean))]
  const demographics = await computeLearnerDemographics(db, {
    mode: 'enrolled',
    userIds: learnerIds,
  })
  sections.push(demographics.section)

  const tables = [
    {
      key: 'engagement',
      title: 'Course engagement',
      columns: engagement?.columns || [],
      rows: engagement?.rows || [],
    },
    {
      key: 'at-risk',
      title: 'At-risk learners',
      columns: atRisk?.columns || [],
      rows: atRisk?.rows || [],
    },
    {
      key: 'friction',
      title: 'Lesson friction',
      columns: friction?.columns || [],
      rows: friction?.rows || [],
    },
    ...demographics.tables,
  ]

  const base: Omit<ReportSnapshot, 'hash'> = {
    generatedAt: new Date().toISOString(),
    range: opts.range,
    audience: 'instructor',
    title: 'Course Insights',
    kpis,
    series,
    funnel,
    institutionScores: [],
    alerts,
    actions,
    tables,
    sections,
    frictionMap,
    breakdowns: demographics.breakdowns,
  }
  void outcomes
  return { ...base, hash: hashSnapshot(base) }
}

export async function buildStudentSnapshot(
  db: Db,
  opts: { userId: string; range: ReportRange }
): Promise<ReportSnapshot> {
  const days = rangeToDays(opts.range)
  const since = daysAgoIso(days)
  const blocks = await computeStudentReports(db, opts.userId)

  const sections: ReportSectionPayload[] = [
    {
      section: 'my-learning',
      title: REPORT_SECTIONS['my-learning'].title,
      description: REPORT_SECTIONS['my-learning'].description,
      blocks,
    },
  ]

  const progress = blocks.find((b) => b.id === 'progress-overview')
  const streak = blocks.find((b) => b.id === 'activity-streak')
  const assessments = blocks.find((b) => b.id === 'assessment-history')
  const certs = blocks.find((b) => b.id === 'certificates')

  const [{ data: enrollments }, { data: lessonProgress }] = await Promise.all([
    db
      .from('enrollments')
      .select('id, course_id, progress_percentage, status, completed_at, enrolled_at, last_accessed_at')
      .eq('user_id', opts.userId)
      .in('status', ['active', 'completed']),
    db
      .from('lesson_progress')
      .select('completed, completed_at, last_accessed_at')
      .eq('user_id', opts.userId),
  ])
  const enrollmentList = (enrollments || []) as any[]
  const progressList = (lessonProgress || []) as any[]

  const kpis: ReportMetric[] = [
    ...(progress?.metrics || []),
    ...(streak?.metrics || []).slice(0, 2),
  ].slice(0, 8)

  const series: ReportSeries[] = [
    {
      key: 'lessons',
      label: 'Lessons completed',
      points: bucketByWeek(
        progressList
          .filter((p) => p.completed && p.completed_at && p.completed_at >= since)
          .map((p) => p.completed_at),
        days
      ),
    },
  ]

  const funnel: FunnelStep[] = [
    { key: 'enrolled', label: 'Courses enrolled', count: enrollmentList.length },
    {
      key: 'inProgress',
      label: 'In progress',
      count: enrollmentList.filter((e) => !e.completed_at && (e.progress_percentage || 0) > 0)
        .length,
    },
    {
      key: 'near',
      label: 'Near complete (≥80%)',
      count: enrollmentList.filter((e) => !e.completed_at && (e.progress_percentage || 0) >= 80)
        .length,
    },
    {
      key: 'done',
      label: 'Completed',
      count: enrollmentList.filter((e) => e.completed_at || e.status === 'completed').length,
    },
  ]

  const near = enrollmentList.filter(
    (e) => !e.completed_at && (e.progress_percentage || 0) >= 80
  ).length
  const alerts: ReportAlert[] = []
  const actions: ReportAction[] = []
  if (near > 0) {
    alerts.push({
      id: 'near',
      severity: 'info',
      title: `${near} course(s) almost done`,
      detail: 'You are at ≥80% — finish to earn your certificate.',
      href: '/learn/progress',
    })
    actions.push({
      id: 'act-finish',
      priority: 1,
      title: 'Finish near-complete courses',
      reason: `${near} enrollment(s) above 80%`,
      href: '/courses',
    })
  } else {
    actions.push({
      id: 'act-continue',
      priority: 1,
      title: 'Continue learning',
      reason: 'Keep your streak going this week.',
      href: '/dashboard',
    })
  }

  const tables = [
    {
      key: 'progress',
      title: 'Course progress',
      columns: progress?.columns || [],
      rows: progress?.rows || [],
    },
    {
      key: 'assessments',
      title: 'Assessments',
      columns: assessments?.columns || [],
      rows: assessments?.rows || [],
    },
    {
      key: 'certificates',
      title: 'Certificates',
      columns: certs?.columns || [],
      rows: certs?.rows || [],
    },
  ]

  const base: Omit<ReportSnapshot, 'hash'> = {
    generatedAt: new Date().toISOString(),
    range: opts.range,
    audience: 'student',
    title: 'My Learning',
    kpis: kpis.length
      ? kpis
      : [{ key: 'courses', label: 'Courses', value: enrollmentList.length }],
    series,
    funnel,
    institutionScores: [],
    alerts,
    actions,
    tables,
    sections,
  }
  return { ...base, hash: hashSnapshot(base) }
}

export async function buildApprovalsSnapshot(
  db: Db,
  opts: { range: ReportRange; institutionIds?: string[] | null }
): Promise<ReportSnapshot> {
  const days = rangeToDays(opts.range)
  const since = daysAgoIso(days)
  const blocks = await computeApprovalsReports(db, {
    institutionIds: opts.institutionIds?.length ? opts.institutionIds : null,
  })

  const sections: ReportSectionPayload[] = [
    {
      section: 'approvals-health',
      title: REPORT_SECTIONS['approvals-health'].title,
      description: REPORT_SECTIONS['approvals-health'].description,
      blocks,
    },
  ]

  const aging = blocks.find((b) => b.id === 'approval-queue-aging')
  const rejection = blocks.find((b) => b.id === 'rejection-reasons')
  const workload = blocks.find((b) => b.id === 'reviewer-workload')
  const activation = blocks.find((b) => b.id === 'post-approval-activation')
  const latency = blocks.find((b) => b.id === 'approval-first-lesson-latency')
  const coverage = blocks.find((b) => b.id === 'institution-coverage')

  const kpis: ReportMetric[] = [
    ...(aging?.metrics || []),
    ...(activation?.metrics || []).slice(0, 2),
  ].slice(0, 8)

  let regQuery = db
    .from('student_registrations')
    .select('submitted_at, reviewed_at, registration_status')
    .limit(2000)
  if (opts.institutionIds?.length) {
    regQuery = regQuery.in('institution_id', opts.institutionIds)
  }
  const { data: regs } = await regQuery
  const regList = (regs || []) as any[]

  const series: ReportSeries[] = [
    {
      key: 'submitted',
      label: 'Submitted',
      points: bucketByWeek(
        regList
          .filter((r) => r.submitted_at && r.submitted_at >= since)
          .map((r) => r.submitted_at),
        days
      ),
    },
    {
      key: 'approved',
      label: 'Approved',
      points: bucketByWeek(
        regList
          .filter(
            (r) =>
              r.registration_status === 'approved' &&
              r.reviewed_at &&
              r.reviewed_at >= since
          )
          .map((r) => r.reviewed_at),
        days
      ),
    },
  ]

  const pending = Number(aging?.metrics?.find((m) => m.key === 'pending')?.value ?? 0)
  const p95 = Number(aging?.metrics?.find((m) => m.key === 'p95')?.value ?? 0)
  const funnel: FunnelStep[] = [
    {
      key: 'submitted',
      label: 'In pipeline',
      count: regList.filter((r) => r.submitted_at || r.registration_status !== 'draft').length,
    },
    {
      key: 'pending',
      label: 'Pending',
      count: pending,
    },
    {
      key: 'approved',
      label: 'Approved',
      count: regList.filter((r) => r.registration_status === 'approved').length,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      count: regList.filter((r) => r.registration_status === 'rejected').length,
    },
  ]

  const alerts: ReportAlert[] = []
  const actions: ReportAction[] = []
  let prio = 1
  if (pending > 0 && p95 > 72) {
    alerts.push({
      id: 'sla',
      severity: 'critical',
      title: 'KYC P95 exceeds 72 hours',
      detail: `P95 is ${p95}h with ${pending} open cases.`,
      href: '/admin/users?tab=approvals',
    })
    actions.push({
      id: 'act-sla',
      priority: prio++,
      title: 'Clear aged approval queue',
      reason: `${pending} pending · P95 ${p95}h`,
      href: '/admin/users?tab=approvals',
    })
  } else if (pending > 0) {
    alerts.push({
      id: 'pending',
      severity: 'watch',
      title: `${pending} registrations awaiting review`,
      detail: 'Keep the queue moving to protect onboarding latency.',
      href: '/admin/users?tab=approvals',
    })
    actions.push({
      id: 'act-queue',
      priority: prio++,
      title: 'Review pending registrations',
      reason: `${pending} in backlog`,
      href: '/admin/users?tab=approvals',
    })
  } else {
    actions.push({
      id: 'act-ok',
      priority: 1,
      title: 'Approvals queue is clear',
      reason: 'No pending KYC backlog in scope.',
      href: '/admin/users?tab=approvals',
    })
  }

  const tables = [
    {
      key: 'aging',
      title: 'Queue aging',
      columns: aging?.columns || [],
      rows: aging?.rows || [],
    },
    {
      key: 'rejections',
      title: 'Rejection reasons',
      columns: rejection?.columns || [],
      rows: rejection?.rows || [],
    },
    {
      key: 'workload',
      title: 'Reviewer workload',
      columns: workload?.columns || [],
      rows: workload?.rows || [],
    },
    {
      key: 'coverage',
      title: 'Institution coverage',
      columns: coverage?.columns || [],
      rows: coverage?.rows || [],
    },
  ]

  void latency
  const base: Omit<ReportSnapshot, 'hash'> = {
    generatedAt: new Date().toISOString(),
    range: opts.range,
    audience: 'resource_person',
    title: 'Approvals & Institution Quality',
    kpis: kpis.length ? kpis : [{ key: 'pending', label: 'Pending', value: pending }],
    series,
    funnel,
    institutionScores: [],
    alerts,
    actions,
    tables,
    sections,
  }
  return { ...base, hash: hashSnapshot(base) }
}
