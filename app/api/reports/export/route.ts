import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { resolveEffectiveRole } from '@/lib/approvals-access'
import { generateExecutiveBrief, isAiGatewayConfigured } from '@/lib/reports/ai-brief'
import { resolveSnapshotForUser } from '@/lib/reports/resolve-snapshot'
import { buildExcelPack } from '@/lib/reports/export/excel'
import { buildDocxPack } from '@/lib/reports/export/docx'
import { buildPdfPack } from '@/lib/reports/export/pdf'
import { audienceAllowsAiBrief } from '@/lib/reports/types'
import type { AiBriefPayload, ReportRange, SnapshotAudience } from '@/lib/reports/types'
import { getRequestUser } from '@/lib/request-user'

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

/** POST /api/reports/export { format, range, includeAiBrief?, audience? } */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .maybeSingle()

    const role = resolveEffectiveRole((profile as any)?.role, user)
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const format = body.format as 'pdf' | 'docx' | 'xlsx'
    if (!['pdf', 'docx', 'xlsx'].includes(format)) {
      return NextResponse.json({ error: 'format must be pdf|docx|xlsx' }, { status: 400 })
    }

    const range = parseRange(body.range)
    const prefer = parsePrefer(body.audience)
    // Students never get AI briefings even if client requests it
    const includeAiBrief =
      Boolean(body.includeAiBrief) && role !== 'student'

    const snapshot = await resolveSnapshotForUser(service as any, {
      userId: user.id,
      role,
      range,
      prefer,
      institutionId: (profile as any)?.institution_id,
    })

    let brief: AiBriefPayload | null = null
    if (includeAiBrief && audienceAllowsAiBrief(snapshot.audience)) {
      const { data: cached } = await service
        .from('report_ai_briefs')
        .select('brief')
        .eq('user_id', user.id)
        .eq('range', range)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      brief = (cached?.brief as AiBriefPayload) || null

      if (!brief && isAiGatewayConfigured()) {
        try {
          brief = await generateExecutiveBrief(snapshot)
          await service.from('report_ai_briefs').insert({
            user_id: user.id,
            role,
            range,
            snapshot_hash: snapshot.hash,
            brief,
          })
        } catch (e) {
          console.warn('[reports/export] AI brief skipped:', e)
        }
      }
    }

    const stamp = new Date().toISOString().slice(0, 10)
    const slug = snapshot.audience
    let buffer: Buffer
    let contentType: string
    let filename: string

    if (format === 'xlsx') {
      buffer = await buildExcelPack(snapshot, brief)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      filename = `pelbu-${slug}-${range}-${stamp}.xlsx`
    } else if (format === 'docx') {
      buffer = await buildDocxPack(snapshot, brief)
      contentType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      filename = `pelbu-${slug}-${range}-${stamp}.docx`
    } else {
      buffer = await buildPdfPack(snapshot, brief)
      contentType = 'application/pdf'
      filename = `pelbu-${slug}-${range}-${stamp}.pdf`
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('[reports/export]', error)
    return NextResponse.json(
      { error: error?.message || 'Export failed' },
      { status: 500 }
    )
  }
}
