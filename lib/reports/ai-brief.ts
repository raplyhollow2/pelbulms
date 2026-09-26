import { z } from 'zod'
import { complete } from '@/lib/ai/complete'
import { isAiGatewayConfigured } from '@/lib/ai/complete'
import type { ModelFamily } from '@/lib/ai/models'
import type {
  AiBriefNarrativeBlock,
  AiBriefPayload,
  AiBriefSection,
  ReportSnapshot,
  SnapshotAudience,
} from '@/lib/reports/types'
import { audienceAllowsAiBrief } from '@/lib/reports/types'
import { snapshotForAiPrompt } from '@/lib/reports/compute-executive'

export { isAiGatewayConfigured }

export const aiBriefSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  caveat: z.string(),
  sections: z
    .array(
      z.object({
        figure: z.string(),
        value: z.string(),
        reading: z.string(),
      })
    )
    .max(8),
  narrative: z
    .array(
      z.object({
        heading: z.string(),
        paragraphs: z.array(z.string()).max(3),
        severity: z.enum(['critical', 'watch', 'opportunity', 'note']),
        tableKey: z.string(),
      })
    )
    .max(6),
  priorities: z
    .array(
      z.object({
        severity: z.enum(['critical', 'watch', 'opportunity']),
        title: z.string(),
        rationale: z.string(),
        suggestedAction: z.string(),
      })
    )
    .max(8),
  questionsForTeam: z.array(z.string()).max(6),
})

export const interpretSchema = z.object({
  answer: z.string(),
  citedFigures: z
    .array(
      z.object({
        figure: z.string(),
        value: z.string(),
      })
    )
    .max(6),
})

function promptForAudience(audience: SnapshotAudience): string {
  switch (audience) {
    case 'instructor':
      return `You are a teaching coach for PelbuLMS instructors.
Focus on at-risk learners, engagement, lesson friction, completions, learner profile mix, and practical classroom interventions.
When learnerProfile is present, use qualification, gender, dzongkhag, and age counts. Do not invent demographic groups.
When frictionMap hotspots are present, use each hotspot's frictionType (drop_off, hesitation, stuck, assessment) and frictionScore.
Recommend fixing only the top 3 friction points with direct, concrete actions — do not propose rewriting the entire course.
Do not invent metrics. Be specific and actionable for course staff.`
    case 'resource_person':
      return `You are an admissions/KYC operations advisor for PelbuLMS resource persons.
Focus on approval queue aging, SLA, rejection patterns, reviewer workload, and post-approval activation.
Do not invent metrics. Be specific and actionable for reviewers.`
    case 'admin':
    case 'superadmin':
    default:
      return `You are an LMS platform advisor for PelbuLMS (Bhutan education).
Focus on actionable priorities: KYC SLA, catalog health, institution performance, learning completion, tenancy/audience risks, and learner profile mix.
When learnerProfile is present, use qualification, gender, dzongkhag, and age counts. Do not invent demographic groups.
Do not invent metrics not present in the JSON. Be specific and practical.`
  }
}

function collectNumbers(value: unknown, into: Set<string>) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.add(String(value))
    if (Number.isInteger(value)) into.add(String(value))
    else into.add(String(Math.round(value * 100) / 100))
    return
  }
  if (typeof value === 'string') {
    const matches = value.match(/-?\d+(?:\.\d+)?/g) || []
    for (const match of matches) into.add(match)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, into)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbers(item, into)
  }
}

function valueIsGrounded(value: string, numbers: Set<string>): boolean {
  const digits = value.match(/-?\d+(?:\.\d+)?/g) || []
  if (!digits.length) return true
  return digits.every((digit) => numbers.has(digit))
}

export function groundBriefSections(
  sections: AiBriefSection[] | undefined,
  source: unknown
): AiBriefSection[] {
  const numbers = new Set<string>()
  collectNumbers(source, numbers)
  return (sections || []).map((section) => {
    if (valueIsGrounded(section.value, numbers)) return section
    return {
      ...section,
      reading: `${section.reading} This cited value is not in the snapshot and should be ignored.`,
    }
  })
}

export function narrativeTableKeys(snapshot: ReportSnapshot): string[] {
  const keys = ['pulse', 'funnel', 'trend', 'actions', 'alerts']
  if (snapshot.breakdowns?.some((item) => item.steps.length > 0)) {
    keys.push('learner-profile')
    for (const breakdown of snapshot.breakdowns) {
      if (breakdown.steps.length) keys.push(`breakdown:${breakdown.key}`)
    }
  }
  if (snapshot.frictionMap?.hotspots.length) keys.push('friction-hotspots')
  if (snapshot.frictionMap?.sequenceFunnel.length) keys.push('friction-sequence')
  if (snapshot.institutionScores.length) keys.push('institutions')
  return keys
}

function absentNote(snapshot: ReportSnapshot): string {
  const missing: string[] = []
  if (!snapshot.breakdowns?.length) missing.push('learner demographics')
  if (!snapshot.frictionMap?.hotspots.length) missing.push('lesson friction')
  if (!snapshot.institutionScores.length) missing.push('institution scores')
  if (!missing.length) return 'Every major block in the JSON is available to cite.'
  return `These blocks are not in this report, so do not discuss them: ${missing.join(', ')}.`
}

export async function generateExecutiveBrief(
  snapshot: ReportSnapshot,
  opts?: { family?: ModelFamily; userId?: string | null }
): Promise<AiBriefPayload> {
  if (!audienceAllowsAiBrief(snapshot.audience)) {
    const err = new Error('AI decision briefings are not available for student accounts.')
    ;(err as { status?: number }).status = 403
    throw err
  }

  const safe = snapshotForAiPrompt(snapshot)
  const tableKeys = narrativeTableKeys(snapshot)
  const result = await complete({
    task: 'report',
    family: opts?.family,
    userId: opts?.userId,
    audience: snapshot.audience,
    schema: aiBriefSchema,
    system: `${promptForAudience(snapshot.audience)}
Each section must name a figure that exists in the JSON and copy its number into value. Do not round into a new number that is not in the JSON.
caveat must say what this report does not show.
narrative is the Word memo: short headings, prose paragraphs, and a tableKey from the allowed list (or an empty string when no table belongs with that heading).
${absentNote(snapshot)}`,
    prompt: `Allowed tableKey values: ${tableKeys.join(', ')}

Snapshot JSON:
${JSON.stringify(safe)}`,
  })

  const narrative: AiBriefNarrativeBlock[] = result.object.narrative.map((block) => ({
    ...block,
    tableKey: tableKeys.includes(block.tableKey) ? block.tableKey : '',
  }))

  return {
    ...result.object,
    sections: groundBriefSections(result.object.sections, safe),
    narrative,
    generatedAt: new Date().toISOString(),
    model: result.model,
    family: result.family,
  }
}

export async function interpretReportQuestion(opts: {
  snapshot: ReportSnapshot
  question: string
  focus?: { label?: string; detail?: string } | null
  family?: ModelFamily
  userId?: string | null
}): Promise<{ answer: string; citedFigures: { figure: string; value: string }[]; model: string; family: ModelFamily }> {
  if (!audienceAllowsAiBrief(opts.snapshot.audience)) {
    const err = new Error('AI decision briefings are not available for student accounts.')
    ;(err as { status?: number }).status = 403
    throw err
  }

  const safe = snapshotForAiPrompt(opts.snapshot)
  const focus = opts.focus?.label
    ? `The user is looking at: ${opts.focus.label}${opts.focus.detail ? ` (${opts.focus.detail})` : ''}.`
    : 'No single chart is selected.'
  const result = await complete({
    task: 'report-followup',
    family: opts.family,
    userId: opts.userId,
    audience: opts.snapshot.audience,
    schema: interpretSchema,
    system: `${promptForAudience(opts.snapshot.audience)}
Answer only from the snapshot JSON. citedFigures must copy numbers that appear in the JSON.
If the question asks about something absent from the JSON, say it is not in this report.
${absentNote(opts.snapshot)}`,
    prompt: `${focus}

Question: ${opts.question}

Snapshot JSON:
${JSON.stringify(safe)}`,
  })

  const numbers = new Set<string>()
  collectNumbers(safe, numbers)
  const citedFigures = result.object.citedFigures.map((item) =>
    valueIsGrounded(item.value, numbers)
      ? item
      : { ...item, value: `${item.value} (not in snapshot)` }
  )

  return {
    answer: result.object.answer,
    citedFigures,
    model: result.model,
    family: result.family,
  }
}
