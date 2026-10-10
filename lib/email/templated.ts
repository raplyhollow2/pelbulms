import { emailPublicUrl, sendEmail } from '@/lib/email/send'
import { renderTemplate, safeActionUrl, sanitizeEmailHtml } from '@/lib/email/template-render'
import { tryCreateServiceClient } from '@/lib/supabase/server'

export type EmailTemplateRow = {
  key: string
  label: string
  description: string
  enabled: boolean
  subject: string
  html_body: string
  text_body: string
  variables: string[]
  updated_at: string | null
}

const LEARNER_PREF_KEYS = new Set([
  'course.published',
  'module.published',
  'module.unpublished',
  'lesson.published',
  'lesson.unpublished',
  'announcement',
  'activity.updated',
])

function asVariables(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function mapTemplate(row: Record<string, unknown>): EmailTemplateRow {
  return {
    key: String(row.key || ''),
    label: String(row.label || ''),
    description: String(row.description || ''),
    enabled: row.enabled === true,
    subject: String(row.subject || ''),
    html_body: String(row.html_body || ''),
    text_body: String(row.text_body || ''),
    variables: asVariables(row.variables),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export async function getEmailTemplate(key: string): Promise<EmailTemplateRow | null> {
  const service = await tryCreateServiceClient()
  if (!service) return null
  const { data, error } = await (service as any)
    .from('email_templates')
    .select('key, label, description, enabled, subject, html_body, text_body, variables, updated_at')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return mapTemplate(data as Record<string, unknown>)
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const service = await tryCreateServiceClient()
  if (!service) return []
  const { data, error } = await (service as any)
    .from('email_templates')
    .select('key, label, description, enabled, subject, html_body, text_body, variables, updated_at')
    .order('label')
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapTemplate)
}

function withAbsoluteAction(vars: Record<string, string>): Record<string, string> {
  const next = { ...vars }
  const raw = next.action_url
  if (typeof raw !== 'string' || !raw.trim()) return next
  if (raw.startsWith('/')) {
    next.action_url = safeActionUrl(raw, emailPublicUrl())
    return next
  }
  try {
    const url = new URL(raw)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
      const base = new URL(emailPublicUrl())
      url.protocol = base.protocol
      url.host = base.host
      next.action_url = url.toString()
    }
  } catch {
    return next
  }
  return next
}

async function learnerOptedOut(userId: string): Promise<boolean> {
  const service = await tryCreateServiceClient()
  if (!service) return false
  const { data } = await (service as any)
    .from('user_settings')
    .select('email_notifications, course_updates')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return false
  const row = data as { email_notifications?: boolean | null; course_updates?: boolean | null }
  return row.email_notifications === false || row.course_updates === false
}

export async function sendTemplatedEmail(input: {
  templateKey: string
  to: string
  userId?: string | null
  vars: Record<string, string>
  respectCoursePreferences?: boolean
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const template = await getEmailTemplate(input.templateKey)
  if (!template || !template.enabled) return { sent: false, skipped: true }

  const respect = input.respectCoursePreferences ?? LEARNER_PREF_KEYS.has(input.templateKey)
  if (respect && input.userId && (await learnerOptedOut(input.userId))) {
    return { sent: false, skipped: true }
  }

  const vars = withAbsoluteAction(input.vars)
  const subject = renderTemplate(template.subject, vars, false).slice(0, 200)
  const text = renderTemplate(template.text_body, vars, false)
  const html = sanitizeEmailHtml(renderTemplate(template.html_body, vars, true))
  return sendEmail({ to: input.to, subject, text, html })
}
