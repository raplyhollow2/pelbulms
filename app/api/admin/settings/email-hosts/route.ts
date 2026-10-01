import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { deliverWithHost, verifyEmailHost } from '@/lib/email/send'
import {
  draftToHost,
  envResendFallback,
  getEmailHost,
  invalidateEmailHostCache,
  last4,
  listEmailHosts,
  normalizeEmailHostDraft,
  toPublicHost,
  type EmailHost,
  type EmailHostDraft,
} from '@/lib/email/hosts'
import { tryCreateServiceClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

async function requireEmailSettings(request: NextRequest, write: boolean) {
  return enforceCapability(
    request,
    write ? CAP.SETTINGS_EMAILS_EDIT : CAP.SETTINGS_EMAILS_VIEW
  )
}

async function statusPayload() {
  const hosts = await listEmailHosts()
  return {
    hosts: hosts.map(toPublicHost),
    envFallback: envResendFallback(),
  }
}

function readDraft(body: Record<string, unknown>) {
  return normalizeEmailHostDraft({
    name: String(body.name || ''),
    provider: String(body.provider || ''),
    fromName: String(body.fromName || ''),
    fromEmail: String(body.fromEmail || ''),
    smtpHost: String(body.smtpHost || ''),
    smtpPort: body.smtpPort == null || body.smtpPort === '' ? null : Number(body.smtpPort),
    smtpSecure: body.smtpSecure === true,
    smtpUsername: String(body.smtpUsername || ''),
    secret: String(body.secret || ''),
    isDefault: body.isDefault === true,
  })
}

async function resolveCandidate(
  body: Record<string, unknown>
): Promise<{ host: EmailHost } | { error: string }> {
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const stored = id ? await getEmailHost(id) : null
  const hasDraft = Boolean(body.provider || body.fromEmail)
  if (!hasDraft) {
    if (!stored) return { error: 'Email host not found' }
    return { host: stored }
  }

  const normalized = readDraft(body)
  if ('error' in normalized) return normalized
  const secret = normalized.value.secret || stored?.secret || ''
  if (!secret) return { error: 'Enter the API key or password' }
  if (stored && stored.provider !== normalized.value.provider && !normalized.value.secret) {
    return { error: 'Enter the secret for this host type' }
  }
  return {
    host: draftToHost(stored?.id || 'draft', { ...normalized.value, secret }, stored && !normalized.value.secret ? stored.secretLast4 : undefined),
  }
}

async function clearOtherDefaults(service: NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>, keepId?: string) {
  let query = service.from('email_hosts' as never).update({ is_default: false } as never).eq('is_default', true)
  if (keepId) query = query.neq('id', keepId)
  const { error } = await query
  return error?.message || null
}

function rowFromDraft(id: string, draft: EmailHostDraft, userId: string) {
  return {
    id,
    name: draft.name,
    provider: draft.provider,
    from_name: draft.fromName || null,
    from_email: draft.fromEmail,
    smtp_host: draft.smtpHost || null,
    smtp_port: draft.smtpPort,
    smtp_secure: draft.smtpSecure,
    smtp_username: draft.smtpUsername || null,
    secret: draft.secret,
    secret_last4: last4(draft.secret),
    is_default: draft.isDefault,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }
}

/**
 * GET /api/admin/settings/email-hosts
 * Host list without secrets, plus whether env Resend is available as a fallback.
 */
export async function GET(request: NextRequest) {
  const rbac = await requireEmailSettings(request, false)
  if (!rbac.hasAccess) return denied(rbac)
  return NextResponse.json(await statusPayload())
}

/**
 * POST /api/admin/settings/email-hosts
 * Body: { action: 'test' | 'send-test', id?, ...draft }
 */
export async function POST(request: NextRequest) {
  const rbac = await requireEmailSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const resolved = await resolveCandidate(body)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 })

  if (body.action === 'test') {
    const error = await verifyEmailHost(resolved.host)
    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'send-test') {
    const service = await tryCreateServiceClient()
    if (!service || !rbac.userId) {
      return NextResponse.json({ error: 'Could not look up your email address' }, { status: 503 })
    }
    const { data: profile } = await service
      .from('profiles')
      .select('email')
      .eq('id', rbac.userId)
      .maybeSingle()
    const to = String(profile?.email || '').trim()
    if (!to) return NextResponse.json({ error: 'Your profile has no email address' }, { status: 400 })

    const result = await deliverWithHost(resolved.host, {
      to,
      subject: 'Pelbu LMS email host test',
      text: `This is a test message from the ${resolved.host.name} email host in Pelbu LMS.`,
    })
    if (!result.sent) {
      return NextResponse.json({ error: result.error || 'Test email was not sent' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, to })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}

/**
 * PUT /api/admin/settings/email-hosts
 * Creates or updates a host. An empty secret keeps the stored secret.
 */
export async function PUT(request: NextRequest) {
  const rbac = await requireEmailSettings(request, true)
  if (!rbac.hasAccess || !rbac.userId) return denied(rbac)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : crypto.randomUUID()
  const stored = UUID_RE.test(id) ? await getEmailHost(id) : null
  if (typeof body.id === 'string' && body.id && !stored) {
    return NextResponse.json({ error: 'Email host not found' }, { status: 404 })
  }

  const normalized = readDraft(body)
  if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 })

  const secret = normalized.value.secret || stored?.secret || ''
  if (!secret) return NextResponse.json({ error: 'Enter the API key or password' }, { status: 400 })
  if (stored && stored.provider !== normalized.value.provider && !normalized.value.secret) {
    return NextResponse.json({ error: 'Enter the secret for this host type' }, { status: 400 })
  }

  const service = await tryCreateServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'The server cannot store email credentials without the service role key' },
      { status: 503 }
    )
  }

  const hosts = await listEmailHosts()
  const others = hosts.filter((host) => host.id !== id)
  const draft: EmailHostDraft = {
    ...normalized.value,
    secret,
    isDefault: normalized.value.isDefault || !others.some((host) => host.isDefault),
  }

  if (draft.isDefault) {
    const clearError = await clearOtherDefaults(service, id)
    if (clearError) return NextResponse.json({ error: clearError }, { status: 400 })
  }

  const { error } = await service.from('email_hosts' as never).upsert(rowFromDraft(id, draft, rbac.userId) as never)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  invalidateEmailHostCache()
  return NextResponse.json(await statusPayload())
}

/**
 * PATCH /api/admin/settings/email-hosts
 * Body: { id } — mark that host as the default sender.
 */
export async function PATCH(request: NextRequest) {
  const rbac = await requireEmailSettings(request, true)
  if (!rbac.hasAccess || !rbac.userId) return denied(rbac)

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id : ''
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Email host not found' }, { status: 404 })

  const stored = await getEmailHost(id)
  if (!stored) return NextResponse.json({ error: 'Email host not found' }, { status: 404 })

  const service = await tryCreateServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'The server cannot update email hosts without the service role key' },
      { status: 503 }
    )
  }

  const clearError = await clearOtherDefaults(service, id)
  if (clearError) return NextResponse.json({ error: clearError }, { status: 400 })

  const { error } = await service
    .from('email_hosts' as never)
    .update({ is_default: true, updated_at: new Date().toISOString(), updated_by: rbac.userId } as never)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  invalidateEmailHostCache()
  return NextResponse.json(await statusPayload())
}

/**
 * DELETE /api/admin/settings/email-hosts?id=
 */
export async function DELETE(request: NextRequest) {
  const rbac = await requireEmailSettings(request, true)
  if (!rbac.hasAccess) return denied(rbac)

  const id = request.nextUrl.searchParams.get('id') || ''
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Email host not found' }, { status: 404 })

  const service = await tryCreateServiceClient()
  if (!service) {
    return NextResponse.json(
      { error: 'The server cannot update email hosts without the service role key' },
      { status: 503 }
    )
  }

  const current = await getEmailHost(id)
  const { error } = await service.from('email_hosts' as never).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  invalidateEmailHostCache()
  if (current?.isDefault) {
    const remaining = await listEmailHosts()
    const next = remaining[0]
    if (next) {
      await service
        .from('email_hosts' as never)
        .update({ is_default: true, updated_at: new Date().toISOString() } as never)
        .eq('id', next.id)
      invalidateEmailHostCache()
    }
  }

  return NextResponse.json(await statusPayload())
}
