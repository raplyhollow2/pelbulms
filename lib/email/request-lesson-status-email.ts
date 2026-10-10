export type MailCount = {
  enrolled: number
  sent: number
  notSent: number
  alreadySent?: boolean
}

export function formatMailCount(mail: MailCount | null | undefined): string {
  if (!mail) return ''
  if (mail.alreadySent && mail.sent === 0) {
    return `Already emailed the ${mail.enrolled} enrolled students for this publish.`
  }
  if (mail.enrolled === 0) return 'No enrolled students to email.'
  if (mail.sent === 0) {
    return `None of the ${mail.enrolled} enrolled students were emailed. Check Site administration → Emails if no mail host is set.`
  }
  if (mail.notSent > 0) {
    return `Emailed ${mail.sent} of ${mail.enrolled} enrolled students. ${mail.notSent} not sent.`
  }
  return `Emailed ${mail.sent} of ${mail.enrolled} enrolled students.`
}

/** Send any lesson published or unpublished emails just queued, and report the count. */
export async function requestLessonStatusEmail(lessonId: string): Promise<MailCount | null> {
  try {
    const res = await fetch(`/api/lessons/${lessonId}/status-email`, { method: 'POST' })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) return null
    return {
      enrolled: Number(payload.enrolled) || 0,
      sent: Number(payload.sent) || 0,
      notSent: Number(payload.notSent) || 0,
      alreadySent: payload.alreadySent === true,
    }
  } catch {
    return null
  }
}
