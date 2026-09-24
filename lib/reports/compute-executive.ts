import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeAdminOpsReports,
  computeApprovalsReports,
  computePlatformCommandReports,
} from '@/lib/reports/compute-admin'
import { computeSystemPulseReports } from '@/lib/reports/compute-system'
import type {
  FunnelStep,
  InstitutionScoreRow,
  ReportAction,
  ReportAlert,
  ReportMetric,
  ReportRange,
  ReportSeries,
  ReportSnapshot,
  ReportSectionPayload,
} from '@/lib/reports/types'
import { rangeToDays } from '@/lib/reports/types'
import { REPORT_SECTIONS } from '@/lib/reports/catalog'

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

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function hashSnapshot(payload: Omit<ReportSnapshot, 'hash'>): string {
  const raw = JSON.stringify({
    range: payload.range,
    audience: payload.audience,
    kpis: payload.kpis,
    funnel: payload.funnel,
    alerts: payload.alerts.map((a) => a.id),
    actions: payload.actions.map((a) => a.id),
    scores: payload.institutionScores.map((s) => [s.id, s.compositeScore]),
  })
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export async function buildReportSnapshot(
  db: Db,
  opts: {
    audience: 'admin' | 'superadmin'
    range: ReportRange
    institutionIds?: string[] | null
  }
): Promise<ReportSnapshot> {
  const days = rangeToDays(opts.range)
  const since = daysAgoIso(days)
  const since14 = daysAgoIso(14)

  const [
    approvalsBlocks,
    opsBlocks,
    platformBlocks,
    systemBlocks,
  ] = await Promise.all([
    computeApprovalsReports(db, {
      institutionIds: opts.institutionIds?.length ? opts.institutionIds : null,
    }),
    computeAdminOpsReports(db),
    opts.audience === 'superadmin'
      ? computePlatformCommandReports(db)
      : Promise.resolve([]),
    opts.audience === 'superadmin' ? computeSystemPulseReports(db) : Promise.resolve([]),
  ])

  const sections: ReportSectionPayload[] = [
    {
      section: 'approvals-health',
      title: REPORT_SECTIONS['approvals-health'].title,
      description: REPORT_SECTIONS['approvals-health'].description,
      blocks: approvalsBlocks,
    },
    {
      section: 'institution-ops',
      title: REPORT_SECTIONS['institution-ops'].title,
      description: REPORT_SECTIONS['institution-ops'].description,
      blocks: opsBlocks,
    },
  ]
  if (opts.audience === 'superadmin') {
    sections.push({
      section: 'platform-command',
      title: REPORT_SECTIONS['platform-command'].title,
      description: REPORT_SECTIONS['platform-command'].description,
      blocks: platformBlocks,
    })
    sections.push({
      section: 'system-pulse',
      title: REPORT_SECTIONS['system-pulse'].title,
      description: REPORT_SECTIONS['system-pulse'].description,
      blocks: systemBlocks,
    })
  }

  const [
    { data: enrollments },
    { data: registrations },
    { data: profiles },
    { data: institutions },
    { data: courses },
  ] = await Promise.all([
    db
      .from('enrollments')
      .select('id, user_id, course_id, status, progress_percentage, last_accessed_at, completed_at, enrolled_at'),
    db
      .from('student_registrations')
      .select(
        'id, user_id, institution_id, registration_status, submitted_at, reviewed_at'
      )
      .limit(3000),
    db.from('profiles').select('id, role, institution_id'),
    db.from('institutions').select('id, name, is_active'),
    db.from('courses').select('id, title, is_published, created_at'),
  ])

  const enrollmentList = (enrollments || []) as any[]
  const regList = (registrations || []) as any[]
  const profileList = (profiles || []) as any[]
  const instList = ((institutions || []) as any[]).filter((i) => i.is_active !== false)
  const courseList = (courses || []) as any[]

  const profileInst = new Map(profileList.map((p) => [p.id, p.institution_id as string | null]))

  // Series
  const enrollDates = enrollmentList
    .filter((e) => e.enrolled_at && e.enrolled_at >= since)
    .map((e) => e.enrolled_at as string)
  const completeDates = enrollmentList
    .filter((e) => e.completed_at && e.completed_at >= since)
    .map((e) => e.completed_at as string)
  const approveDates = regList
    .filter(
      (r) =>
        r.registration_status === 'approved' && r.reviewed_at && r.reviewed_at >= since
    )
    .map((r) => r.reviewed_at as string)

  const series: ReportSeries[] = [
    { key: 'enrollments', label: 'Enrollments', points: bucketByWeek(enrollDates, days) },
    { key: 'completions', label: 'Completions', points: bucketByWeek(completeDates, days) },
    { key: 'approvals', label: 'KYC approvals', points: bucketByWeek(approveDates, days) },
  ]

  // Funnel
  const submitted = regList.filter((r) => r.submitted_at || r.registration_status !== 'draft').length
  const approved = regList.filter((r) => r.registration_status === 'approved').length
  const enrolledUsers = new Set(enrollmentList.map((e) => e.user_id))
  const approvedThenEnrolled = regList.filter(
    (r) => r.registration_status === 'approved' && r.user_id && enrolledUsers.has(r.user_id)
  ).length
  const completions = enrollmentList.filter(
    (e) => e.completed_at || e.status === 'completed'
  ).length
  const funnel: FunnelStep[] = [
    { key: 'submitted', label: 'KYC submitted', count: submitted },
    { key: 'approved', label: 'Approved', count: approved },
    { key: 'enrolled', label: 'First enrollment', count: approvedThenEnrolled },
    { key: 'completed', label: 'Course completed', count: completions },
  ]

  // Institution scores
  const decisionHoursByInst: Record<string, number[]> = {}
  for (const r of regList) {
    if (!r.institution_id || !r.reviewed_at || !r.submitted_at) continue
    const h =
      (new Date(r.reviewed_at).getTime() - new Date(r.submitted_at).getTime()) /
      (1000 * 60 * 60)
    if (h < 0) continue
    if (!decisionHoursByInst[r.institution_id]) decisionHoursByInst[r.institution_id] = []
    decisionHoursByInst[r.institution_id].push(h)
  }

  const institutionScores: InstitutionScoreRow[] = instList.map((inst) => {
    const members = profileList.filter((p) => p.institution_id === inst.id)
    const memberSet = new Set(members.map((m) => m.id))
    const ens = enrollmentList.filter((e) => memberSet.has(e.user_id))
    const active = ens.filter((e) => e.last_accessed_at && e.last_accessed_at >= since14).length
    const completed = ens.filter((e) => e.completed_at || e.status === 'completed').length
    const activeRate = ens.length ? Math.round((active / ens.length) * 100) : 0
    const completionRate = ens.length ? Math.round((completed / ens.length) * 100) : 0
    const medH = median(decisionHoursByInst[inst.id] || [])
    // Composite: weight activity + completion, penalize slow approvals
    const approvalPenalty =
      medH == null ? 10 : Math.max(0, 30 - Math.min(30, Math.round(medH / 4)))
    const compositeScore = Math.round(activeRate * 0.4 + completionRate * 0.4 + approvalPenalty)
    return {
      id: inst.id,
      name: inst.name,
      members: members.length,
      enrollments: ens.length,
      activeRate,
      completionRate,
      medianApprovalHours: medH,
      compositeScore,
    }
  }).sort((a, b) => b.compositeScore - a.compositeScore)

  // KPIs from ops metrics + live
  const wau = new Set(
    enrollmentList
      .filter((e) => e.last_accessed_at && e.last_accessed_at >= daysAgoIso(7))
      .map((e) => e.user_id)
  ).size
  const mau = new Set(
    enrollmentList
      .filter((e) => e.last_accessed_at && e.last_accessed_at >= daysAgoIso(30))
      .map((e) => e.user_id)
  ).size
  const pendingKyc = regList.filter((r) =>
    ['submitted', 'under_review', 'additional_info_requested', 'waitlisted'].includes(
      r.registration_status
    )
  ).length

  const agingBlock = approvalsBlocks.find((b) => b.id === 'approval-queue-aging')
  const p95 =
    agingBlock?.metrics?.find((m) => m.key === 'p95')?.value ?? '—'
  const darkBlock = opsBlocks.find((b) => b.id === 'dark-catalog')
  const darkCount = darkBlock?.rows?.length ?? 0
  const misfitBlock = opsBlocks.find((b) => b.id === 'audience-lock-misfit')
  const misfitCount = misfitBlock?.rows?.length ?? 0
  const tenancyBlock = systemBlocks.find((b) => b.id === 'tenancy-leak')
  const leakCount =
    Number(tenancyBlock?.metrics?.find((m) => m.key === 'leaks')?.value ?? 0) || 0
  const quietBlock = opsBlocks.find((b) => b.id === 'instructor-health')
  const quietCount = quietBlock?.rows?.length ?? 0

  const completionRate =
    enrollmentList.length > 0
      ? Math.round((completions / enrollmentList.length) * 100)
      : 0

  const kpis: ReportMetric[] = [
    { key: 'wau', label: 'Active learners (7d)', value: wau, hint: 'Via enrollment last access' },
    { key: 'mau', label: 'Active learners (30d)', value: mau },
    { key: 'pendingKyc', label: 'Pending KYC', value: pendingKyc },
    { key: 'kycP95', label: 'KYC decision P95 (h)', value: p95 },
    { key: 'completionRate', label: 'Completion rate', value: `${completionRate}%` },
    { key: 'published', label: 'Published courses', value: courseList.filter((c) => c.is_published).length },
    { key: 'darkCatalog', label: 'Dark catalog', value: darkCount },
    { key: 'tenancyLeaks', label: 'Tenancy leaks', value: leakCount },
  ]

  // SLA breaches: pending > 72h
  const slaBreaches = pendingKyc
    ? regList.filter((r) => {
        if (
          !['submitted', 'under_review', 'additional_info_requested', 'waitlisted'].includes(
            r.registration_status
          )
        )
          return false
        const submittedAt = r.submitted_at
        if (!submittedAt) return false
        const ageH = (Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60)
        return ageH > 72
      }).length
    : 0

  const alerts: ReportAlert[] = []
  if (slaBreaches > 0) {
    alerts.push({
      id: 'kyc-sla',
      severity: 'critical',
      title: `${slaBreaches} KYC cases over 72h`,
      detail: 'Approval SLA breach — reviewers should clear the oldest backlog first.',
      href: '/admin/users?tab=approvals',
    })
  }
  if (leakCount > 0) {
    alerts.push({
      id: 'tenancy',
      severity: 'critical',
      title: `${leakCount} possible institution audience leaks`,
      detail: 'Enrollments on restricted courses outside course_institutions audience.',
      href: '/admin/reports',
    })
  }
  if (darkCount > 0) {
    alerts.push({
      id: 'dark-catalog',
      severity: 'watch',
      title: `${darkCount} dark-catalog courses`,
      detail: 'Published 30+ days with ≤1 enrollment.',
      href: '/admin/reports',
    })
  }
  if (misfitCount > 0) {
    alerts.push({
      id: 'audience-misfit',
      severity: 'watch',
      title: `${misfitCount} audience-lock misfits`,
      detail: 'Restricted courses with eligible students but zero enrollments.',
    })
  }
  if (quietCount > 0) {
    alerts.push({
      id: 'quiet-courses',
      severity: 'info',
      title: `${quietCount} quiet courses`,
      detail: 'Published with enrollments but no 30-day learner activity.',
    })
  }

  const actions: ReportAction[] = []
  let prio = 1
  if (slaBreaches > 0) {
    actions.push({
      id: 'act-kyc',
      priority: prio++,
      title: 'Clear KYC backlog over 72 hours',
      reason: `${slaBreaches} registrations exceed SLA`,
      href: '/admin/users?tab=approvals',
    })
  }
  if (Number(p95) > 72 || (typeof p95 === 'number' && p95 > 72)) {
    actions.push({
      id: 'act-p95',
      priority: prio++,
      title: 'Investigate KYC P95 latency',
      reason: `Decision P95 is ${p95} hours`,
      href: '/admin/users?tab=approvals',
    })
  }
  if (darkCount > 0) {
    actions.push({
      id: 'act-dark',
      priority: prio++,
      title: 'Review dark-catalog courses',
      reason: `${darkCount} published courses with near-zero enrollments`,
      href: '/courses',
    })
  }
  if (misfitCount > 0) {
    actions.push({
      id: 'act-misfit',
      priority: prio++,
      title: 'Fix audience locks with zero enrollments',
      reason: `${misfitCount} restricted courses have eligible students but no enrollments`,
      href: '/admin/settings/institutions',
    })
  }
  if (leakCount > 0) {
    actions.push({
      id: 'act-leak',
      priority: prio++,
      title: 'Audit tenancy leaks',
      reason: `${leakCount} enrollments may violate course institution audience rules`,
      href: '/admin/reports',
    })
  }
  if (actions.length === 0) {
    actions.push({
      id: 'act-ok',
      priority: 1,
      title: 'No critical actions',
      reason: 'Key SLAs and catalog risks look healthy in this window.',
      href: '/admin/reports',
    })
  }
  actions.push({
    id: 'act-course-insights',
    priority: prio++,
    title: 'Open course insights',
    reason: 'Grading queues and course health for every teacher.',
    href: '/teach/reports',
  })

  const tables = [
    {
      key: 'institutions',
      title: 'Institution scoreboard',
      columns: [
        { key: 'name', label: 'Institution' },
        { key: 'members', label: 'Members' },
        { key: 'enrollments', label: 'Enrollments' },
        { key: 'activeRate', label: 'Active %' },
        { key: 'completionRate', label: 'Completion %' },
        { key: 'medianApprovalHours', label: 'Median KYC (h)' },
        { key: 'compositeScore', label: 'Score' },
      ],
      rows: institutionScores.map((s) => ({
        id: s.id,
        cells: {
          name: s.name,
          members: s.members,
          enrollments: s.enrollments,
          activeRate: s.activeRate,
          completionRate: s.completionRate,
          medianApprovalHours: s.medianApprovalHours ?? '—',
          compositeScore: s.compositeScore,
        },
      })),
    },
    {
      key: 'dark-catalog',
      title: 'Dark catalog',
      columns: darkBlock?.columns || [
        { key: 'course', label: 'Course' },
        { key: 'enrollments', label: 'Enrollments' },
      ],
      rows: darkBlock?.rows || [],
    },
    {
      key: 'audience-misfit',
      title: 'Audience lock misfit',
      columns: misfitBlock?.columns || [
        { key: 'course', label: 'Course' },
        { key: 'eligibleStudents', label: 'Eligible' },
      ],
      rows: misfitBlock?.rows || [],
    },
  ]

  const base: Omit<ReportSnapshot, 'hash'> = {
    generatedAt: new Date().toISOString(),
    range: opts.range,
    audience: opts.audience,
    title:
      opts.audience === 'superadmin'
        ? 'Executive Command Center'
        : 'Institution Ops Report',
    kpis,
    series,
    funnel,
    institutionScores,
    alerts,
    actions,
    tables,
    sections,
  }

  return { ...base, hash: hashSnapshot(base) }
}

/** Sanitize snapshot for AI prompts (no PII fields beyond institution names). */
export function snapshotForAiPrompt(snapshot: ReportSnapshot) {
  return {
    audience: snapshot.audience,
    title: snapshot.title,
    range: snapshot.range,
    generatedAt: snapshot.generatedAt,
    kpis: snapshot.kpis,
    funnel: snapshot.funnel,
    series: snapshot.series.map((s) => ({
      key: s.key,
      label: s.label,
      points: s.points,
    })),
    institutionScores: snapshot.institutionScores.map((s) => ({
      name: s.name,
      members: s.members,
      enrollments: s.enrollments,
      activeRate: s.activeRate,
      completionRate: s.completionRate,
      medianApprovalHours: s.medianApprovalHours,
      compositeScore: s.compositeScore,
    })),
    alerts: snapshot.alerts.map((a) => ({
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    })),
    actions: snapshot.actions.map((a) => ({
      title: a.title,
      reason: a.reason,
    })),
    frictionMap: snapshot.frictionMap
      ? {
          hotspots: snapshot.frictionMap.hotspots.slice(0, 10).map((h) => ({
            lesson: h.lessonTitle,
            course: h.courseTitle,
            finishRate: h.finishRate,
            dropOffPct: h.dropOffPct,
            stuckRate: h.stuckRate,
            avgMinutes: h.avgMinutes,
            quizFailRate: h.quizFailRate,
            frictionType: h.frictionType,
            frictionScore: h.frictionScore,
          })),
          sequenceCourseTitle: snapshot.frictionMap.sequenceCourseTitle,
          sequenceFunnel: snapshot.frictionMap.sequenceFunnel,
        }
      : undefined,
  }
}
