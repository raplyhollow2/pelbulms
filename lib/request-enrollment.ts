export type EnrollmentRequestResult = {
  ok: boolean
  httpStatus: number
  data: {
    error?: string
    message?: string
    status?: string
    pending?: boolean
    alreadyEnrolled?: boolean
    needsKyc?: boolean
    enrollmentMode?: string
    enrollmentId?: string
  }
}

export async function postEnrollmentRequest(
  courseId: string,
  extras?: { inviteCode?: string; sessionId?: string }
): Promise<EnrollmentRequestResult> {
  const res = await fetch('/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId,
      inviteCode: extras?.inviteCode?.trim() || undefined,
      sessionId: extras?.sessionId,
    }),
  })
  const raw = await res.text()
  let data: EnrollmentRequestResult['data'] = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { error: raw?.slice(0, 200) || `HTTP ${res.status}` }
  }
  return { ok: res.ok, httpStatus: res.status, data }
}
