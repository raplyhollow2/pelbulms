import { generateObject, zodSchema } from 'ai'
import { z } from 'zod'
import type { AiBriefPayload, ReportSnapshot, SnapshotAudience } from '@/lib/reports/types'
import { audienceAllowsAiBrief } from '@/lib/reports/types'
import { snapshotForAiPrompt } from '@/lib/reports/compute-executive'

export const aiBriefSchema = z.object({
  headline: z.string(),
  summary: z.string(),
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

const REPORTS_MODEL = 'anthropic/claude-sonnet-4.5'

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === '1')
}

function promptForAudience(audience: SnapshotAudience): string {
  switch (audience) {
    case 'instructor':
      return `You are a teaching coach for PelbuLMS instructors.
Focus on at-risk learners, engagement, lesson friction, completions, and practical classroom interventions.
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
Focus on actionable priorities: KYC SLA, catalog health, institution performance, learning completion, tenancy/audience risks.
Do not invent metrics not present in the JSON. Be specific and practical.`
  }
}

export async function generateExecutiveBrief(
  snapshot: ReportSnapshot
): Promise<AiBriefPayload> {
  if (!audienceAllowsAiBrief(snapshot.audience)) {
    const err = new Error('AI decision briefings are not available for student accounts.')
    ;(err as any).status = 403
    throw err
  }

  if (!isAiGatewayConfigured()) {
    const err = new Error(
      'AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy with Vercel OIDC) to enable Claude briefings.'
    )
    ;(err as any).status = 503
    throw err
  }

  const safe = snapshotForAiPrompt(snapshot)
  const { object } = await generateObject({
    model: REPORTS_MODEL,
    schema: zodSchema(aiBriefSchema),
    prompt: `${promptForAudience(snapshot.audience)}

Snapshot JSON:
${JSON.stringify(safe)}`,
  })

  return {
    ...object,
    generatedAt: new Date().toISOString(),
    model: REPORTS_MODEL,
  }
}
