import {
  formatFromAddress,
  getDefaultEmailHost,
  type EmailHost,
} from '@/lib/email/hosts'

const PLACEHOLDER_HOSTS = new Set([
  'your-vercel-app.vercel.app',
  'example.com',
  'example.org',
])

const E2E_EMAIL_RE = /@rigbu-e2e\.test$/i

function usableOrigin(value: string | undefined | null): string | null {
  if (!value?.trim()) return null
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const url = new URL(withProtocol)
    if (!url.hostname || PLACEHOLDER_HOSTS.has(url.hostname)) return null
    return url.origin
  } catch {
    return null
  }
}

/** Public site origin for links in emails and certificates. Skips placeholder hosts. */
export function publicAppUrl(requestOrigin?: string | null): string {
  return (
    usableOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    usableOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    usableOrigin(requestOrigin) ||
    usableOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    usableOrigin(process.env.VERCEL_URL) ||
    'https://pelbulms.vercel.app'
  )
}

export type OutboundEmail = {
  to: string
  subject: string
  text: string
  html?: string
}

function safeError(message: string, secret: string) {
  const cleaned = secret ? message.split(secret).join('••••') : message
  return cleaned.slice(0, 240)
}

function friendlySmtpError(message: string, host: EmailHost) {
  const lower = message.toLowerCase()
  const rejected =
    lower.includes('535') ||
    lower.includes('badcredentials') ||
    lower.includes('username and password not accepted') ||
    lower.includes('authentication unsuccessful')
  if (rejected && host.provider === 'gmail_smtp') {
    return 'Gmail rejected this login. Use a Google app password, not your Gmail account password. Turn on 2-Step Verification, create an app password, and paste that 16-character password here.'
  }
  if (rejected) {
    return 'The mail server rejected this username or password.'
  }
  return safeError(message, host.secret)
}

function smtpOptions(host: EmailHost) {
  return {
    host: host.smtpHost || undefined,
    port: host.smtpPort || undefined,
    secure: host.smtpSecure,
    auth: {
      user: host.smtpUsername || '',
      pass: host.secret,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  }
}

const RIGBU_EMAIL_LOGO = 'https://www.rigbu.app/email-logo-400.png'

function escapeEmailText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function withBrandLogo(html: string | undefined, text: string) {
  const logo = `<p style="margin:0 0 16px"><img src="${RIGBU_EMAIL_LOGO}" width="200" height="70" alt="Rigbu" style="display:block;border:0;width:200px;height:auto" /></p>`
  if (html?.trim()) return `${logo}${html}`
  return `${logo}<p style="margin:0">${escapeEmailText(text).replace(/\n/g, '<br />')}</p>`
}

function brandOutboundEmail(opts: OutboundEmail): OutboundEmail {
  return { ...opts, html: withBrandLogo(opts.html, opts.text) }
}

async function deliverResend(
  apiKey: string,
  from: string,
  opts: OutboundEmail
): Promise<{ sent: boolean; error?: string }> {
  const branded = brandOutboundEmail(opts)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [branded.to],
        subject: branded.subject,
        text: branded.text,
        html: branded.html,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        sent: false,
        error: safeError(
          `Email failed (${res.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`,
          apiKey
        ),
      }
    }
    return { sent: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Email send failed'
    return { sent: false, error: safeError(message, apiKey) }
  }
}

async function deliverSmtp(
  host: EmailHost,
  opts: OutboundEmail
): Promise<{ sent: boolean; error?: string }> {
  const branded = brandOutboundEmail(opts)
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport(smtpOptions(host))
    await transporter.sendMail({
      from: formatFromAddress(host.fromName, host.fromEmail),
      to: branded.to,
      subject: branded.subject,
      text: branded.text,
      html: branded.html,
    })
    return { sent: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'SMTP send failed'
    return { sent: false, error: friendlySmtpError(message, host) }
  }
}

export async function deliverWithHost(
  host: EmailHost,
  opts: OutboundEmail
): Promise<{ sent: boolean; error?: string }> {
  if (host.provider === 'resend') {
    return deliverResend(host.secret, formatFromAddress(host.fromName, host.fromEmail), opts)
  }
  return deliverSmtp(host, opts)
}

/** Check credentials without sending mail. Returns an error message, or null on success. */
export async function verifyEmailHost(host: EmailHost): Promise<string | null> {
  if (!host.secret) return 'A secret is required'
  if (host.provider === 'resend') {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${host.secret}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        return res.status === 401 || res.status === 403
          ? 'Resend rejected this API key'
          : `Resend check failed (${res.status})`
      }
      return null
    } catch (e: unknown) {
      return e instanceof Error ? safeError(e.message, host.secret) : 'Resend check failed'
    }
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport(smtpOptions(host))
    await transporter.verify()
    return null
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'SMTP connection failed'
    return friendlySmtpError(message, host)
  }
}

export async function sendEmail(opts: OutboundEmail): Promise<{ sent: boolean; error?: string }> {
  const to = opts.to?.trim()
  if (!to) return { sent: false, error: 'No recipient' }
  if (E2E_EMAIL_RE.test(to)) return { sent: false }

  const host = await getDefaultEmailHost()
  if (host) return deliverWithHost(host, { ...opts, to })

  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not configured' }
  const from = (process.env.RESEND_FROM || '').trim() || 'Rigbu LMS <noreply@rigbu.bt>'
  return deliverResend(apiKey, from, { ...opts, to })
}
