// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { generateEnrollmentCode, deliverInvite } from '@/lib/invite-delivery'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: rbac.error?.includes('Unauthorized') ? 401 : 403 })
  }
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await service
    .from('enrollment_invites')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ invites: data || [] })
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string | undefined
  const email = (body.email as string | undefined)?.trim() || null
  const phone = (body.phone as string | undefined)?.trim() || null
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  if (!email && !phone) {
    return NextResponse.json({ error: 'Provide a student email or mobile number' }, { status: 400 })
  }

  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: course } = await service
    .from('courses')
    .select('id, title')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  let code = generateEnrollmentCode()
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await service
      .from('enrollment_invites')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!clash) break
    code = generateEnrollmentCode()
  }

  const { data: invite, error } = await service
    .from('enrollment_invites')
    .insert({
      course_id: courseId,
      created_by: rbac.userId,
      code,
      student_email: email,
      student_phone: phone,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      delivery: email && phone ? 'email_sms' : email ? 'email' : 'sms',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const delivery = await deliverInvite({
    email,
    phone,
    code,
    courseTitle: (course as any).title,
  })

  return NextResponse.json({
    invite,
    delivery,
    message: delivery.emailSent || delivery.smsSent
      ? 'Code created and sent'
      : 'Code created. Copy it and send it to the student (email/SMS is not configured).',
  })
}
