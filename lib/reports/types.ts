import type { UserRole } from '@/lib/roles'

export type ReportAudience =
  | 'student'
  | 'instructor'
  | 'resource_person'
  | 'admin'
  | 'superadmin'
  | 'developer'

export type ReportSectionId =
  | 'my-learning'
  | 'course-insights'
  | 'approvals-health'
  | 'institution-ops'
  | 'platform-command'
  | 'system-pulse'

export type ReportId =
  // Student
  | 'progress-overview'
  | 'activity-streak'
  | 'assessment-history'
  | 'certificates'
  | 'communication-digest'
  // Instructor
  | 'engagement'
  | 'at-risk'
  | 'assessment-quality'
  | 'roster-ops'
  | 'outcomes'
  | 'lesson-friction'
  // Resource person
  | 'approval-queue-aging'
  | 'rejection-reasons'
  | 'reviewer-workload'
  | 'post-approval-activation'
  | 'approval-first-lesson-latency'
  | 'institution-coverage'
  // Admin
  | 'adoption'
  | 'catalog-health'
  | 'access-audience'
  | 'learning-outcomes'
  | 'assessed-results'
  | 'registration-funnel'
  | 'instructor-health'
  | 'dark-catalog'
  | 'audience-lock-misfit'
  // Superadmin
  | 'cross-tenant'
  | 'role-audit'
  | 'feature-adoption'
  | 'intervention-effectiveness'
  | 'live-presence'
  // Developer / System Pulse
  | 'data-quality'
  | 'enrollment-state-machine'
  | 'tenancy-leak'
  | 'path-breakage'
  | 'teacher-time-to-value'
  | 'instrumentation-gaps'

export interface ReportDefinition {
  id: ReportId
  section: ReportSectionId
  title: string
  description: string
  audiences: ReportAudience[]
  phase: 'P0' | 'P1' | 'P2'
}

export interface ReportMetric {
  key: string
  label: string
  value: string | number
  hint?: string
}

export interface ReportRow {
  id: string
  cells: Record<string, string | number | boolean | null>
}

export interface ReportBlock {
  id: ReportId
  title: string
  description?: string
  metrics?: ReportMetric[]
  columns?: { key: string; label: string }[]
  rows?: ReportRow[]
  emptyMessage?: string
}

export interface ReportSectionPayload {
  section: ReportSectionId
  title: string
  description: string
  blocks: ReportBlock[]
}

export function roleToAudiences(role: UserRole): ReportAudience[] {
  switch (role) {
    case 'student':
      return ['student']
    case 'instructor':
      return ['instructor']
    case 'resource_person':
      return ['resource_person', 'instructor']
    case 'admin':
      return ['admin', 'instructor']
    case 'superadmin':
      return ['superadmin', 'admin', 'instructor', 'developer']
    default:
      return ['student']
  }
}

/** Date window for executive snapshots */
export type ReportRange = '7d' | '30d' | '90d'

export function rangeToDays(range: ReportRange): number {
  if (range === '7d') return 7
  if (range === '90d') return 90
  return 30
}

export interface ReportSeriesPoint {
  date: string
  value: number
}

export interface ReportSeries {
  key: string
  label: string
  points: ReportSeriesPoint[]
}

export interface ReportAlert {
  id: string
  severity: 'critical' | 'watch' | 'info'
  title: string
  detail: string
  href?: string
}

export interface ReportAction {
  id: string
  priority: number
  title: string
  reason: string
  href: string
}

export interface FunnelStep {
  key: string
  label: string
  count: number
}

export interface InstitutionScoreRow {
  id: string
  name: string
  members: number
  enrollments: number
  activeRate: number
  completionRate: number
  medianApprovalHours: number | null
  compositeScore: number
}

/** Primary behavioral friction cause (not UX clickstream). */
export type FrictionType = 'drop_off' | 'hesitation' | 'stuck' | 'assessment'

export interface FrictionHotspot {
  lessonId: string
  lessonTitle: string
  courseId: string
  courseTitle: string
  starts: number
  finishes: number
  finishRate: number
  dropOffPct: number
  avgMinutes: number
  cohortMedianMinutes: number
  stuckRate: number
  quizFailRate: number | null
  frictionType: FrictionType
  frictionScore: number
}

export interface FrictionMapPayload {
  hotspots: FrictionHotspot[]
  sequenceFunnel: FunnelStep[]
  sequenceCourseTitle?: string
  sequenceCourseId?: string
}

export interface AiBriefPriority {
  severity: 'critical' | 'watch' | 'opportunity'
  title: string
  rationale: string
  suggestedAction: string
}

export interface AiBriefPayload {
  headline: string
  summary: string
  priorities: AiBriefPriority[]
  questionsForTeam: string[]
  generatedAt?: string
  model?: string
}

/** Single source of truth for Command Center + exports + AI briefs */
export type SnapshotAudience =
  | 'superadmin'
  | 'admin'
  | 'instructor'
  | 'resource_person'
  | 'student'

export interface ReportSnapshot {
  generatedAt: string
  range: ReportRange
  audience: SnapshotAudience
  title: string
  kpis: ReportMetric[]
  series: ReportSeries[]
  funnel: FunnelStep[]
  institutionScores: InstitutionScoreRow[]
  alerts: ReportAlert[]
  actions: ReportAction[]
  tables: {
    key: string
    title: string
    columns: { key: string; label: string }[]
    rows: ReportRow[]
  }[]
  /** Raw section blocks for legacy tab view / deep dive */
  sections: ReportSectionPayload[]
  /** Instructor behavioral friction map (omit for other audiences). */
  frictionMap?: FrictionMapPayload
  hash: string
}

/** Roles allowed to request AI decision briefings (students excluded). */
export function audienceAllowsAiBrief(audience: SnapshotAudience): boolean {
  return audience !== 'student'
}
