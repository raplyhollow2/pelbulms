import { NextRequest, NextResponse } from 'next/server'
import { reportServerError } from '@/lib/telemetry'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : 'Client error'
  reportServerError(new Error(message), {
    digest: typeof body.digest === 'string' ? body.digest.slice(0, 80) : undefined,
    kind: 'client',
  })
  return NextResponse.json({ ok: true })
}
