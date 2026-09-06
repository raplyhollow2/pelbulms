export function publicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/\/$/, '')
    return host.startsWith('http') ? host : `https://${host}`
  }
  return 'http://localhost:3000'
}

const E2E_EMAIL_RE = /@pelbu-e2e\.test$/i

export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<{ sent: boolean; error?: string }> {
  const to = opts.to?.trim()
  if (!to) return { sent: false, error: 'No recipient' }
  if (E2E_EMAIL_RE.test(to)) {
    return { sent: false }
  }
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, error: 'RESEND_API_KEY is not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Pelbu LMS <noreply@pelbu.bt>',
        to: [to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { sent: false, error: `Email failed (${res.status})${detail ? `: ${detail.slice(0, 180)}` : ''}` }
    }
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'Email send failed' }
  }
}
