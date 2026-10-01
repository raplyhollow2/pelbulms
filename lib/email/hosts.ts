import { tryCreateServiceClient } from '@/lib/supabase/server'

const CACHE_MS = 30_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailProvider = 'resend' | 'gmail_smtp' | 'smtp'

export type EmailHost = {
  id: string
  name: string
  provider: EmailProvider
  fromName: string | null
  fromEmail: string
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUsername: string | null
  secret: string
  secretLast4: string
  isDefault: boolean
}

export type EmailHostPublic = Omit<EmailHost, 'secret'>

export type EmailHostDraft = {
  name: string
  provider: EmailProvider
  fromName: string
  fromEmail: string
  smtpHost: string
  smtpPort: number | null
  smtpSecure: boolean
  smtpUsername: string
  secret: string
  isDefault: boolean
}

type HostCache = {
  at: number
  hosts: EmailHost[]
}

let cache: HostCache | null = null

export function invalidateEmailHostCache() {
  cache = null
}

export function last4(value: string) {
  const trimmed = value.trim()
  return trimmed.slice(-4)
}

export function formatFromAddress(name: string | null | undefined, email: string) {
  const clean = (name || '').replace(/["\r\n]/g, '').trim()
  if (!clean) return email
  return `${clean} <${email}>`
}

export function envResendFallback(): { configured: boolean; from: string | null } {
  const key = (process.env.RESEND_API_KEY || '').trim()
  const from = (process.env.RESEND_FROM || '').trim()
  const configured = Boolean(key && key.length > 8 && !key.includes('your-'))
  return { configured, from: from || null }
}

function isProvider(value: string): value is EmailProvider {
  return value === 'resend' || value === 'gmail_smtp' || value === 'smtp'
}

export function normalizeEmailHostDraft(raw: {
  name?: string
  provider?: string
  fromName?: string
  fromEmail?: string
  smtpHost?: string
  smtpPort?: number | null
  smtpSecure?: boolean
  smtpUsername?: string
  secret?: string
  isDefault?: boolean
}): { value: EmailHostDraft } | { error: string } {
  const provider = String(raw.provider || '')
  if (!isProvider(provider)) return { error: 'Choose a host type' }

  const fromEmail = String(raw.fromEmail || '').trim().toLowerCase()
  if (!EMAIL_RE.test(fromEmail)) return { error: 'Enter a valid from email' }

  const fromName = String(raw.fromName || '').replace(/[\r\n]/g, '').trim()
  let name = String(raw.name || '').replace(/[\r\n]/g, '').trim()
  if (!name) {
    name = provider === 'resend' ? 'Resend' : provider === 'gmail_smtp' ? 'Gmail' : 'SMTP'
  }
  if (name.length > 80) return { error: 'Name must be 80 characters or fewer' }

  const isDefault = raw.isDefault === true

  if (provider === 'resend') {
    return {
      value: {
        name,
        provider,
        fromName,
        fromEmail,
        smtpHost: '',
        smtpPort: null,
        smtpSecure: false,
        smtpUsername: '',
        secret: String(raw.secret || '').trim(),
        isDefault,
      },
    }
  }

  if (provider === 'gmail_smtp') {
    const port = Number(raw.smtpPort) === 465 ? 465 : 587
    const username = String(raw.smtpUsername || fromEmail).trim().toLowerCase()
    if (!EMAIL_RE.test(username)) return { error: 'Enter the Gmail address used to sign in' }
    return {
      value: {
        name,
        provider,
        fromName,
        fromEmail,
        smtpHost: 'smtp.gmail.com',
        smtpPort: port,
        smtpSecure: port === 465,
        smtpUsername: username,
        secret: String(raw.secret || '').replace(/\s/g, ''),
        isDefault,
      },
    }
  }

  const smtpHost = String(raw.smtpHost || '').trim()
  const smtpPort = Number(raw.smtpPort)
  const smtpUsername = String(raw.smtpUsername || '').trim()
  if (!smtpHost || smtpHost.length > 255) return { error: 'SMTP host is required' }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    return { error: 'Enter a valid SMTP port' }
  }
  if (!smtpUsername) return { error: 'SMTP username is required' }

  return {
    value: {
      name,
      provider,
      fromName,
      fromEmail,
      smtpHost,
      smtpPort,
      smtpSecure: raw.smtpSecure === true || smtpPort === 465,
      smtpUsername,
      secret: String(raw.secret || ''),
      isDefault,
    },
  }
}

function mapRow(row: Record<string, unknown>): EmailHost | null {
  const provider = String(row.provider || '')
  if (!isProvider(provider)) return null
  const secret = String(row.secret || '')
  if (!secret) return null
  return {
    id: String(row.id),
    name: String(row.name || ''),
    provider,
    fromName: row.from_name ? String(row.from_name) : null,
    fromEmail: String(row.from_email || ''),
    smtpHost: row.smtp_host ? String(row.smtp_host) : null,
    smtpPort: row.smtp_port == null ? null : Number(row.smtp_port),
    smtpSecure: Boolean(row.smtp_secure),
    smtpUsername: row.smtp_username ? String(row.smtp_username) : null,
    secret,
    secretLast4: String(row.secret_last4 || last4(secret)),
    isDefault: Boolean(row.is_default),
  }
}

export function draftToHost(id: string, draft: EmailHostDraft, secretLast4?: string): EmailHost {
  return {
    id,
    name: draft.name,
    provider: draft.provider,
    fromName: draft.fromName || null,
    fromEmail: draft.fromEmail,
    smtpHost: draft.smtpHost || null,
    smtpPort: draft.smtpPort,
    smtpSecure: draft.smtpSecure,
    smtpUsername: draft.smtpUsername || null,
    secret: draft.secret,
    secretLast4: secretLast4 || last4(draft.secret),
    isDefault: draft.isDefault,
  }
}

export function toPublicHost(host: EmailHost): EmailHostPublic {
  const { secret: _secret, ...rest } = host
  return rest
}

async function loadHosts(): Promise<EmailHost[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.hosts
  try {
    const service = await tryCreateServiceClient()
    if (!service) {
      cache = { at: Date.now(), hosts: [] }
      return []
    }
    const { data, error } = await service
      .from('email_hosts' as never)
      .select(
        'id, name, provider, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_username, secret, secret_last4, is_default'
      )
      .order('is_default', { ascending: false })
    if (error || !data) return cache?.hosts ?? []
    const hosts = (data as Record<string, unknown>[]).map(mapRow).filter((row): row is EmailHost => Boolean(row))
    cache = { at: Date.now(), hosts }
    return hosts
  } catch {
    return cache?.hosts ?? []
  }
}

export async function listEmailHosts(): Promise<EmailHost[]> {
  return loadHosts()
}

export async function getEmailHost(id: string): Promise<EmailHost | null> {
  const hosts = await loadHosts()
  return hosts.find((host) => host.id === id) ?? null
}

export async function getDefaultEmailHost(): Promise<EmailHost | null> {
  const hosts = await loadHosts()
  return hosts.find((host) => host.isDefault) ?? hosts[0] ?? null
}
