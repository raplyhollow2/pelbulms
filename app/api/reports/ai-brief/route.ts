import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { generateExecutiveBrief } from '@/lib/reports/ai-brief'
import { isFeatureConfigured } from '@/lib/ai/dispatch'
import type { AiBriefPayload } from '@/lib/reports/types'
import { resolveSnapshotForUser } from '@/lib/reports/resolve-snapshot'
import { audienceAllowsAiBrief } from '@/lib/reports/types'
import type { ReportRange, SnapshotAudience } from '@/lib/reports/types'
import { getRequestUser } from '@/lib/request-user'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(userId: string, limit = 10, windowMs = 60 * 60 * 1000): boolean {
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

async function findCachedBrief(
  service: { from: (table: string) => any },
  opts: { userId: string; range: string; hash?: string }
) {
  const { data } = await service
    .from('report_ai_briefs')
    .select('id, brief, created_at, snapshot_hash')
    .eq('user_id', opts.userId)
    .eq('range', opts.range)
    .order('created_at', { ascending: false })
    .limit(12)
  const rows = ((data || []) as {
    id: string
    brief: AiBriefPayload
    created_at: string
    snapshot_hash: string
  }[]).filter((row) => !opts.hash || row.snapshot_hash === opts.hash)
  return rows[0] || null
}

/** POST /api/reports/ai-brief */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      )
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const role = resolveEffectiveRole((profile as any).role, user)
    if (!AI_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'AI decision briefings are not available for student accounts.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const range = parseRange(body.range)
    const force = Boolean(body.force)
    const prefer = parsePrefer(body.audience)

    const snapshot = await resolveSnapshotForUser(service as any, {
      userId: user.id,
      role,
      range,
      prefer,
      institutionId: (profile as any).institution_id,
    })

    if (!audienceAllowsAiBrief(snapshot.audience)) {
      return NextResponse.json(
        { error: 'AI decision briefings are not available for student accounts.' },
        { status: 403 }
      )
    }

    if (!force) {
      const cached = await findCachedBrief(service, {
        userId: user.id,
        range,
        hash: snapshot.hash,
      })

      if (cached?.brief) {
        return NextResponse.json({
          brief: cached.brief,
          cached: true,
          snapshotHash: snapshot.hash,
          createdAt: cached.created_at,
        })
      }
    }

    const brief = await generateExecutiveBrief(snapshot, { userId: user.id })

    await (service as any).from('report_ai_briefs').insert({
      user_id: user.id,
      role,
      range,
      snapshot_hash: snapshot.hash,
      brief,
    })

    return NextResponse.json({
      brief,
      cached: false,
      snapshotHash: snapshot.hash,
      createdAt: brief.generatedAt,
    })
  } catch (error: any) {
    console.error('[reports/ai-brief]', error)
    const status = typeof error?.status === 'number' ? error.status : 500
    return NextResponse.json(
      { error: error?.message || 'Failed to generate briefing' },
      { status }
    )
  }
}

/** GET /api/reports/ai-brief?range=30d */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = resolveEffectiveRole((profile as any)?.role, user)

    if (!AI_ROLES.has(role)) {
      return NextResponse.json({
        brief: null,
        configured: await isFeatureConfigured('report'),
        allowed: false,
      })
    }

    const range = parseRange(request.nextUrl.searchParams.get('range'))
    const cached = await findCachedBrief(service, {
      userId: user.id,
      range,
    })

    return NextResponse.json({
      brief: cached?.brief || null,
      createdAt: cached?.created_at || null,
      snapshotHash: cached?.snapshot_hash || null,
      configured: await isFeatureConfigured('report'),
      allowed: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load briefing' },
      { status: 500 }
    )
  }
}
