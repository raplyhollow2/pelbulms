export function generateEnrollmentCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export async function deliverInvite(opts: {
  email?: string | null
  phone?: string | null
  code: string
  courseTitle: string
  studentName?: string
}): Promise<{ emailSent: boolean; smsSent: boolean; error?: string }> {
  let emailSent = false
  let smsSent = false
  let error: string | undefined

  if (opts.email && process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Pelbu LMS <noreply@pelbu.bt>',
          to: [opts.email],
          subject: `Your enrollment code for ${opts.courseTitle}`,
          text: `Your unique enrollment code for “${opts.courseTitle}” is ${opts.code}. Enter it on the course page to join.`,
        }),
      })
      emailSent = res.ok
      if (!res.ok) error = `Email failed (${res.status})`
    } catch (e: any) {
      error = e?.message || 'Email send failed'
    }
  }

  if (opts.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const auth = Buffer.from(`${sid}:${token}`).toString('base64')
      const body = new URLSearchParams({
        To: opts.phone,
        From: process.env.TWILIO_FROM,
        Body: `Pelbu LMS: your code for ${opts.courseTitle} is ${opts.code}`,
      })
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      smsSent = res.ok
      if (!res.ok && !error) error = `SMS failed (${res.status})`
    } catch (e: any) {
      error = error || e?.message || 'SMS send failed'
    }
  }

  return { emailSent, smsSent, error }
}
