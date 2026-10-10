import { NextRequest, NextResponse } from 'next/server'
import { CAP, enforceCapability } from '@/lib/rbac'
import { emailPublicUrl, sendEmail } from '@/lib/email/send'
import {
  escapeHtml,
  renderTemplate,
  safeActionUrl,
  sanitizeEmailHtml,
  unknownTemplateTokens,
} from '@/lib/email/template-render'
import { listEmailTemplates, mapTemplate } from '@/lib/email/templated'
import { tryCreateServiceClient } from '@/lib/supabase/server'

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

const SAMPLE: Record<string, string> = {
  learner_name: 'Alex',
  student_name: 'Alex',
  course_title: 'AI for business',
  module_title: 'Module 2',
  lesson_title: 'Prompting for operations',
  activity_title: 'Reflection',
  title: 'New announcement',
  message: 'Module 2 is ready when you are.',
  verb: 'submitted',
  headline: 'New registration pending approval',
  applicant_name: 'Alex',
  applicant_email: 'alex@example.com',
  registration_kind: 'student',
  institution_name: 'Rigbu',
  reason: 'The application needs a clearer institution.',
  code: 'AB12CD34',
  action_url: '/learn',
}

export async function GET(request: NextRequest) {
  const rbac = await enforceCapability(request, CAP.SETTINGS_EMAIL_TEMPLATES_VIEW)
  if (!rbac.hasAccess) return denied(rbac)
  const service = await tryCreateServiceClient()
  const templates = await listEmailTemplates()
  const dead: Record<string, { count: number; lastError: string | null }> = {}
  if (service) {
    const { data } = await (service as any)
      .from('email_deliveries')
      .select('template_key, last_error, created_at')
      .eq('status', 'dead')
      .order('created_at', { ascending: false })
      .limit(200)
    for (const row of data || []) {
      const key = (row as { template_key?: string }).template_key || ''
      if (!key) continue
      const current = dead[key] || { count: 0, lastError: null }
      current.count += 1
      if (!current.lastError) current.lastError = (row as { last_error?: string | null }).last_error || null
      dead[key] = current
    }
  }
  return NextResponse.json({ templates, dead })
}

export async function PATCH(request: NextRequest) {
  const rbac = await enforceCapability(request, CAP.SETTINGS_EMAIL_TEMPLATES_EDIT)
  if (!rbac.hasAccess) return denied(rbac)
  const body = await request.json().catch(() => null)
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!key) return NextResponse.json({ error: 'Template key is required' }, { status: 400 })

  const service = await tryCreateServiceClient()
  if (!service) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  const { data: existing, error: loadError } = await (service as any)
    .from('email_templates')
    .select('key, variables')
    .eq('key', key)
    .maybeSingle()
  if (loadError || !existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const variables = Array.isArray(existing.variables)
    ? existing.variables.filter((item: unknown): item is string => typeof item === 'string')
    : []
  const subject = String(body?.subject || '').slice(0, 200)
  const textBody = String(body?.textBody || '').slice(0, 20000)
  const htmlBody = sanitizeEmailHtml(String(body?.htmlBody || '').slice(0, 20000))
  const unknown = [
    ...unknownTemplateTokens(subject, variables),
    ...unknownTemplateTokens(textBody, variables),
    ...unknownTemplateTokens(htmlBody, variables),
  ]
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown fields: ${[...new Set(unknown)].join(', ')}` }, { status: 400 })
  }
  if (!subject.trim() || !textBody.trim()) {
    return NextResponse.json({ error: 'Subject and plain text are required' }, { status: 400 })
  }

  const { data, error } = await (service as any)
    .from('email_templates')
    .update({
      enabled: body?.enabled === true,
      subject,
      text_body: textBody,
      html_body: htmlBody,
      updated_by: rbac.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)
    .select('key, label, description, enabled, subject, html_body, text_body, variables, updated_at')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not save template' }, { status: 400 })
  return NextResponse.json({ template: mapTemplate(data as Record<string, unknown>) })
}

export async function POST(request: NextRequest) {
  const rbac = await enforceCapability(request, CAP.SETTINGS_EMAIL_TEMPLATES_EDIT)
  if (!rbac.hasAccess) return denied(rbac)
  const body = await request.json().catch(() => null)
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!key) return NextResponse.json({ error: 'Template key is required' }, { status: 400 })

  const service = await tryCreateServiceClient()
  if (!service || !rbac.userId) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  const { data: profile } = await (service as any)
    .from('profiles')
    .select('email')
    .eq('id', rbac.userId)
    .maybeSingle()
  const to = (profile as { email?: string | null } | null)?.email
  if (!to) return NextResponse.json({ error: 'Your profile has no email address' }, { status: 400 })

  const { data: template } = await (service as any)
    .from('email_templates')
    .select('subject, html_body, text_body, variables')
    .eq('key', key)
    .maybeSingle()
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const vars: Record<string, string> = {}
  const allowed = Array.isArray(template.variables) ? template.variables : []
  for (const token of allowed) {
    if (typeof token !== 'string') continue
    vars[token] = token === 'action_url' ? safeActionUrl(SAMPLE.action_url, emailPublicUrl()) : SAMPLE[token] || token
  }
  const result = await sendEmail({
    to,
    subject: `[Test] ${renderTemplate(String(template.subject || ''), vars, false)}`.slice(0, 200),
    text: renderTemplate(String(template.text_body || ''), vars, false),
    html: sanitizeEmailHtml(renderTemplate(String(template.html_body || ''), vars, true)) || `<p>${escapeHtml('Test')}</p>`,
  })
  if (!result.sent) return NextResponse.json({ error: result.error || 'Test send failed' }, { status: 400 })
  return NextResponse.json({ sent: true, to })
}
