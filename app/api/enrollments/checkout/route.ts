// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const auth = await createSupabaseServerClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'Paid enrollment is not configured. Add STRIPE_SECRET_KEY to enable checkout.',
        enrollmentMode: 'paid',
      },
      { status: 501 }
    )
  }

  const service = await createServiceClient()
  const { data: course } = await service
    .from('courses')
    .select('id, title, price, enrollment_mode')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if ((course as any).enrollment_mode !== 'paid') {
    return NextResponse.json({ error: 'This course is not in paid mode' }, { status: 400 })
  }

  const amount = Math.max(1, Math.round(Number((course as any).price || 0) * 100))
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/courses/${courseId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/courses/${courseId}`,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][product_data][name]': (course as any).title,
      'metadata[courseId]': courseId,
      'metadata[userId]': user.id,
    }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message || 'Stripe error' }, { status: 400 })
  return NextResponse.json({ url: data.url })
}
