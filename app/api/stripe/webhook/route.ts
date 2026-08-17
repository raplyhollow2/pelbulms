// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyTeacherOfEnrollment } from '@/lib/notify-teachers'

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!secret || !stripeKey) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 501 })
  }

  const raw = await request.text()
  const sig = request.headers.get('stripe-signature') || ''
  const parts = Object.fromEntries(
    sig.split(',').map((p) => {
      const [k, ...rest] = p.split('=')
      return [k.trim(), rest.join('=')]
    })
  )
  const timestamp = parts.t
  const expected = parts.v1
  if (!timestamp || !expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${raw}`))
  const hex = [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex !== expected) {
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 })
  }

  const event = JSON.parse(raw)
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }
  const session = event.data?.object || {}
  const courseId = session.metadata?.courseId
  const userId = session.metadata?.userId
  if (!courseId || !userId) return NextResponse.json({ received: true })

  const service = await createServiceClient()
  const { data: existing } = await service
    .from('enrollments')
    .select('id, status')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (existing) {
    if ((existing as any).status !== 'active') {
      await service
        .from('enrollments')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return NextResponse.json({ received: true, enrolled: true })
  }

  await service.from('enrollments').insert({
    user_id: userId,
    course_id: courseId,
    status: 'active',
    progress_percentage: 0,
  })
  try {
    await notifyTeacherOfEnrollment(service, { courseId, studentId: userId, pending: false })
  } catch {}
  return NextResponse.json({ received: true, enrolled: true })
}
