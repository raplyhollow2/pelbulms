import type {
  AiBriefPayload,
  FrictionType,
  ReportBlock,
  ReportSectionPayload,
  ReportSeries,
  ReportSnapshot,
} from '@/lib/reports/types'
import { lessonHref } from '@/lib/reports/action-links'

const FRICTION_LABELS: Record<FrictionType, string> = {
  drop_off: 'Drop-off',
  hesitation: 'Hesitation',
  stuck: 'Stuck',
  assessment: 'Assessment',
}

export interface OutlineMetric {
  key: string
  label: string
  value: string | number
  hint?: string
  href?: string
}

export interface OutlineColumn {
  key: string
  label: string
}

export interface OutlineRow {
  id: string
  cells: Record<string, string | number | boolean | null>
  href?: string
  actionLabel?: string
}

/** One slice of the on-screen report, in dashboard order. */
export interface OutlinePart {
  id: string
  title: string
  description?: string
  level: 1 | 2
  /** Parent section title, used when a block is written on its own sheet. */
  sectionTitle?: string
  /** Excel tab name when the on-screen title would collide with another sheet. */
  sheetTitle?: string
  metrics?: OutlineMetric[]
  bars?: { key: string; label: string; count: number }[]
  columns?: OutlineColumn[]
  rows?: OutlineRow[]
  emptyMessage?: string
  paragraphs?: string[]
}

export interface ReportOutline {
  title: string
  subtitle: string
  parts: OutlinePart[]
  appendix: OutlinePart[]
}

export function outlineCellText(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

/** Table columns plus Action and Link when the on-screen rows have them. */
export function outlineTable(part: OutlinePart): {
  columns: OutlineColumn[]
  rows: OutlineRow[]
} | null {
  if (!part.columns?.length) return null
  const source = part.rows || []
  const extra: OutlineColumn[] = []
  if (source.some((row) => row.actionLabel)) extra.push({ key: '__action', label: 'Action' })
  if (source.some((row) => row.href)) extra.push({ key: '__link', label: 'Link' })
  return {
    columns: [...part.columns, ...extra],
    rows: source.map((row) => ({
      ...row,
      cells: {
        ...row.cells,
        ...(extra.some((column) => column.key === '__action')
          ? { __action: row.actionLabel || '' }
          : {}),
        ...(extra.some((column) => column.key === '__link') ? { __link: row.href || '' } : {}),
      },
    })),
  }
}

export function partHasFacts(part: OutlinePart): boolean {
  return Boolean(
    part.metrics?.length ||
      part.bars?.length ||
      part.columns?.length ||
      part.paragraphs?.length
  )
}

export function buildReportOutline(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): ReportOutline {
  const parts: OutlinePart[] = []

  if (snapshot.kpis.length) {
    parts.push({
      id: 'pulse',
      title: "Today's pulse",
      level: 1,
      metrics: snapshot.kpis.map((kpi) => ({
        key: kpi.key,
        label: kpi.label,
        value: kpi.value,
        hint: kpi.hint,
        href: kpi.href,
      })),
    })
  }

  if (snapshot.funnel.length) {
    parts.push({
      id: 'funnel',
      title: 'Growth funnel',
      level: 1,
      bars: snapshot.funnel,
    })
  }

  const series = snapshot.series.filter((item) => item.points.length > 0)
  if (series.length) {
    parts.push(trendPart(series))
  }

  const breakdowns = (snapshot.breakdowns || []).filter((item) => item.steps.length > 0)
  if (breakdowns.length) {
    parts.push({
      id: 'learner-profile',
      title: 'Learner profile',
      description: 'Each person is counted once.',
      level: 1,
    })
    for (const breakdown of breakdowns) {
      parts.push({
        id: `breakdown:${breakdown.key}`,
        title: breakdown.title,
        description: breakdown.description,
        level: 2,
        sectionTitle: 'Learner profile',
        sheetTitle: `Profile ${breakdown.title}`,
        bars: breakdown.steps,
      })
    }
  }

  const friction = snapshot.frictionMap
  if (friction && friction.hotspots.length > 0) {
    parts.push({
      id: 'friction-hotspots',
      title: 'Friction hotspots',
      description: 'Top lessons by composite friction score.',
      level: 1,
      columns: [
        { key: 'lesson', label: 'Lesson' },
        { key: 'course', label: 'Course' },
        { key: 'type', label: 'Type' },
        { key: 'score', label: 'Score' },
      ],
      rows: friction.hotspots.map((hotspot) => ({
        id: hotspot.lessonId,
        href: lessonHref(hotspot.courseId, hotspot.lessonId),
        actionLabel: 'Edit lesson',
        cells: {
          lesson: hotspot.lessonTitle,
          course: hotspot.courseTitle,
          type: FRICTION_LABELS[hotspot.frictionType] || hotspot.frictionType,
          score: hotspot.frictionScore,
        },
      })),
    })
  }
  if (friction && friction.sequenceFunnel.length > 0) {
    parts.push({
      id: 'friction-sequence',
      title: 'Lesson sequence starts',
      description: friction.sequenceCourseTitle
        ? `Start counts along ${friction.sequenceCourseTitle}`
        : 'Start counts along the highest-friction course path',
      level: 1,
      bars: friction.sequenceFunnel,
    })
  }

  if (snapshot.institutionScores.length) {
    const links = new Map(
      (snapshot.tables.find((table) => table.key === 'institutions')?.rows || []).map((row) => [
        row.id,
        row.href,
      ])
    )
    parts.push({
      id: 'institutions',
      title: 'Institution scoreboard',
      level: 1,
      columns: [
        { key: 'name', label: 'Institution' },
        { key: 'members', label: 'Members' },
        { key: 'enrollments', label: 'Enrollments' },
        { key: 'activeRate', label: 'Active %' },
        { key: 'completionRate', label: 'Completion %' },
        { key: 'medianApprovalHours', label: 'Median KYC (h)' },
        { key: 'score', label: 'Score' },
      ],
      rows: snapshot.institutionScores.map((score) => ({
        id: score.id,
        href: links.get(score.id),
        actionLabel: links.get(score.id) ? 'Open catalog' : undefined,
        cells: {
          name: score.name,
          members: score.members,
          enrollments: score.enrollments,
          activeRate: score.activeRate,
          completionRate: score.completionRate,
          medianApprovalHours: score.medianApprovalHours ?? '',
          score: score.compositeScore,
        },
      })),
    })
  }

  if (snapshot.actions.length) {
    parts.push({
      id: 'actions',
      title: 'Action queue',
      description: 'Priorities from live thresholds',
      level: 1,
      columns: [
        { key: 'priority', label: 'Priority' },
        { key: 'title', label: 'Title' },
        { key: 'reason', label: 'Reason' },
      ],
      rows: snapshot.actions.map((action) => ({
        id: action.id,
        href: action.href,
        actionLabel: 'Open',
        cells: {
          priority: action.priority,
          title: action.title,
          reason: action.reason,
        },
      })),
    })
  }

  if (snapshot.alerts.length) {
    parts.push({
      id: 'alerts',
      title: 'Alerts',
      level: 1,
      columns: [
        { key: 'severity', label: 'Severity' },
        { key: 'title', label: 'Title' },
        { key: 'detail', label: 'Detail' },
      ],
      rows: snapshot.alerts.map((alert) => ({
        id: alert.id,
        href: alert.href,
        actionLabel: alert.href ? 'Open' : undefined,
        cells: {
          severity: alert.severity,
          title: alert.title,
          detail: alert.detail,
        },
      })),
    })
  }

  const detailed = snapshot.sections.filter((section) => section.blocks.length > 0)
  if (detailed.length) {
    parts.push({
      id: 'detailed-reports',
      title: 'Detailed reports',
      level: 1,
    })
    for (const section of detailed) {
      parts.push({
        id: `section:${section.section}`,
        title: section.title,
        description: section.description,
        level: 1,
      })
      for (const block of section.blocks) {
        parts.push(blockPart(section, block))
      }
    }
  }

  return {
    title: snapshot.title,
    subtitle: `PelbuLMS · ${snapshot.range} · ${new Date(snapshot.generatedAt).toLocaleString()} · ${snapshot.audience}`,
    parts,
    appendix: briefAppendix(brief),
  }
}

function trendPart(series: ReportSeries[]): OutlinePart {
  const dates: string[] = []
  const seen = new Set<string>()
  for (const item of series) {
    for (const point of item.points) {
      if (seen.has(point.date)) continue
      seen.add(point.date)
      dates.push(point.date)
    }
  }
  return {
    id: 'trend',
    title: 'Weekly trends',
    level: 1,
    columns: [
      { key: 'date', label: 'Week' },
      ...series.map((item) => ({ key: item.key, label: item.label })),
    ],
    rows: dates.map((date) => ({
      id: date,
      cells: {
        date,
        ...Object.fromEntries(
          series.map((item) => [
            item.key,
            item.points.find((point) => point.date === date)?.value ?? 0,
          ])
        ),
      },
    })),
  }
}

function blockPart(section: ReportSectionPayload, block: ReportBlock): OutlinePart {
  const metrics: OutlineMetric[] = (block.metrics || []).map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
    hint: metric.hint,
    href: metric.href,
  }))
  if (block.split) {
    const keys = new Set(metrics.map((metric) => metric.key))
    if (!keys.has('pending')) {
      metrics.push({ key: 'pending', label: 'Pending', value: block.split.pending })
    }
    if (!keys.has('graded')) {
      metrics.push({ key: 'graded', label: 'Graded', value: block.split.graded })
    }
  }
  return {
    id: `${section.section}:${block.id}`,
    title: block.title,
    description: block.description,
    level: 2,
    sectionTitle: section.title,
    metrics: metrics.length ? metrics : undefined,
    columns: block.columns?.length ? block.columns : undefined,
    rows: block.rows,
    emptyMessage: block.columns?.length ? block.emptyMessage || 'No rows.' : block.emptyMessage,
  }
}

function briefAppendix(brief?: AiBriefPayload | null): OutlinePart[] {
  if (!brief) return []
  const parts: OutlinePart[] = [
    {
      id: 'ai-brief',
      title: 'AI decision briefing',
      level: 1,
      paragraphs: [brief.headline, brief.summary, brief.caveat].filter(
        (line): line is string => Boolean(line && line.trim())
      ),
    },
  ]
  if (brief.sections?.length) {
    parts.push({
      id: 'ai-figures',
      title: 'Cited figures',
      level: 2,
      columns: [
        { key: 'figure', label: 'Figure' },
        { key: 'value', label: 'Value' },
        { key: 'reading', label: 'Reading' },
      ],
      rows: brief.sections.map((section, index) => ({
        id: String(index),
        cells: {
          figure: section.figure,
          value: section.value,
          reading: section.reading,
        },
      })),
    })
  }
  if (brief.priorities.length) {
    parts.push({
      id: 'ai-priorities',
      title: 'Priorities',
      level: 2,
      columns: [
        { key: 'severity', label: 'Severity' },
        { key: 'title', label: 'Title' },
        { key: 'rationale', label: 'Rationale' },
        { key: 'suggestedAction', label: 'Suggested action' },
      ],
      rows: brief.priorities.map((priority, index) => ({
        id: String(index),
        cells: {
          severity: priority.severity,
          title: priority.title,
          rationale: priority.rationale,
          suggestedAction: priority.suggestedAction,
        },
      })),
    })
  }
  if (brief.questionsForTeam.length) {
    parts.push({
      id: 'ai-questions',
      title: 'Questions for the team',
      level: 2,
      paragraphs: brief.questionsForTeam,
    })
  }
  return parts
}
