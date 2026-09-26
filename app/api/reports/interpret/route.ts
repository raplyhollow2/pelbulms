import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { interpretReportQuestion, isAiGatewayConfigured } from '@/lib/reports/ai-brief'
import { resolveSnapshotForUser } from '@/lib/reports/resolve-snapshot'
import { audienceAllowsAiBrief } from '@/lib/reports/types'
import type { ReportRange, SnapshotAudience } from '@/lib/reports/types'
import { getRequestUser } from '@/lib/request-user'
import { parseModelFamily } from '@/lib/ai/models'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(userId: string, limit = 20, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now()
  const row = rateBuckets.get(userId)
  if (!row || row.resetAt < now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (row.count >= limit) return false
  row.count += 1
  return true
}

function parseRange(raw: unknown): ReportRange {
  if (raw === '7d' || raw === '90d' || raw === '30d') return raw
  return '30d'
}

function parsePrefer(raw: unknown): SnapshotAudience | undefined {
  if (
    raw === 'superadmin' ||
    raw === 'admin' ||
    raw === 'instructor' ||
    raw === 'resource_person' ||
    raw === 'student'
  ) {
    return raw
  }
  return undefined
}

const AI_ROLES = new Set(['admin', 'superadmin', 'instructor', 'resource_person'])

/** POST /api/reports/interpret — follow-up grounded on the caller's snapshot. */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!rateLimit(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const role = resolveEffectiveRole((profile as { role?: string }).role, user)
    if (!AI_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'AI decision briefings are not available for student accounts.' },
        { status: 403 }
      )
    }
    if (!isAiGatewayConfigured()) {
      return NextResponse.json(
        {
          error:
            'AI Gateway is not configured. Set AI_GATEWAY_API_KEY (or deploy with Vercel OIDC) to enable report interpretation.',
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const question = String(body.question || '').trim()
    if (!question) return NextResponse.json({ error: 'Ask a question about this report.' }, { status: 400 })
    if (question.length > 800) {
      return NextResponse.json({ error: 'Keep the question under 800 characters.' }, { status: 400 })
    }

    const range = parseRange(body.range)
    const prefer = parsePrefer(body.audience)
    const family = body.family ? parseModelFamily(body.family, 'claude') : undefined
    const focus =
      body.focus && typeof body.focus === 'object'
        ? {
            label: typeof body.focus.label === 'string' ? body.focus.label : undefined,
            detail: typeof body.focus.detail === 'string' ? body.focus.detail : undefined,
          }
        : null

    const snapshot = await resolveSnapshotForUser(service as never, {
      userId: user.id,
      role,
      range,
      prefer,
      institutionId: (profile as { institution_id?: string | null }).institution_id,
    })

    if (!audienceAllowsAiBrief(snapshot.audience)) {
      return NextResponse.json(
        { error: 'AI decision briefings are not available for student accounts.' },
        { status: 403 }
      )
    }

    if (typeof body.snapshotHash === 'string' && body.snapshotHash && body.snapshotHash !== snapshot.hash) {
      return NextResponse.json(
        { error: 'This report changed. Generate a fresh reading, then ask again.' },
        { status: 409 }
      )
    }

    const reading = await interpretReportQuestion({
      snapshot,
      question,
      focus,
      family,
      userId: user.id,
    })

    return NextResponse.json({
      ...reading,
      snapshotHash: snapshot.hash,
    })
  } catch (error) {
    console.error('[reports/interpret]', error)
    const status =
      (error as { status?: number })?.status === 503
        ? 503
        : (error as { status?: number })?.status === 403
          ? 403
          : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not interpret this report' },
      { status }
    )
  }
}
