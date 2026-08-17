// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  const service = await createServiceClient()
  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  const { data: staff } = await service
    .from('course_instructors')
    .select('id, user_id, role, created_at, profiles:user_id (id, full_name, email, avatar_url)')
    .eq('course_id', courseId)

  return NextResponse.json({
    ownerId: (course as any)?.instructor_id || null,
    staff: staff || [],
  })
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string
  const email = String(body.email || '').trim().toLowerCase()
  const role = body.role === 'assistant' ? 'assistant' : 'co_teacher'
  if (!courseId || !email) {
    return NextResponse.json({ error: 'courseId and email are required' }, { status: 400 })
  }
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile } = await service
    .from('profiles')
    .select('id, email, full_name, role')
    .ilike('email', email)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'No user with that email. They must register first.' }, { status: 404 })
  }

  const { data, error } = await service
    .from('course_instructors')
    .upsert(
      {
        course_id: courseId,
        user_id: (profile as any).id,
        role,
        invited_by: rbac.userId,
      },
      { onConflict: 'course_id,user_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ staff: data })
}

export async function DELETE(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const courseId = request.nextUrl.searchParams.get('courseId')
  const userId = request.nextUrl.searchParams.get('userId')
  if (!courseId || !userId) {
    return NextResponse.json({ error: 'courseId and userId are required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  if ((course as any)?.instructor_id === userId) {
    return NextResponse.json({ error: 'Cannot remove the course owner' }, { status: 400 })
  }
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { error } = await service
    .from('course_instructors')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
