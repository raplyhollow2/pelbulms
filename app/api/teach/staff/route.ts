// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const
const INVITE_ROLES = ['instructor', 'resource_person'] as const

export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  const { data: staff } = await service
    .from('course_instructors')
    .select('id, user_id, role, created_at, profiles:user_id (id, full_name, email, avatar_url)')
    .eq('course_id', courseId)

  let teacherQuery = await service
    .from('profiles')
    .select('id, full_name, email, role, account_status')
    .in('role', [...INVITE_ROLES])
    .order('full_name')
  if (teacherQuery.error && /account_status/.test(teacherQuery.error.message || '')) {
    teacherQuery = await service
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', [...INVITE_ROLES])
      .order('full_name')
  }

  const teachers = ((teacherQuery.data || []) as Array<{
    id: string
    full_name?: string | null
    email?: string | null
    role?: string | null
    account_status?: string | null
  }>)
    .filter((teacher) => teacher.id !== rbac.userId)
    .filter((teacher) => !teacher.account_status || teacher.account_status === 'active')
    .map(({ id, full_name, email, role }) => ({ id, full_name, email, role }))

  return NextResponse.json({
    ownerId: (course as any)?.instructor_id || null,
    staff: staff || [],
    teachers,
  })
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const courseId = body.courseId as string
  const userId = String(body.userId || '').trim()
  const role = body.role === 'assistant' ? 'assistant' : 'co_teacher'
  if (!courseId || !userId) {
    return NextResponse.json({ error: 'courseId and a teacher are required' }, { status: 400 })
  }
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, email, full_name, role, account_status')
    .eq('id', userId)
    .maybeSingle()
  if (profileError && /account_status/.test(profileError.message || '')) {
    const fallback = await service.from('profiles').select('id, email, full_name, role').eq('id', userId).maybeSingle()
    profile = fallback.data
    profileError = fallback.error
  }
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  if (!profile) {
    return NextResponse.json({ error: 'That instructor or resource person could not be found.' }, { status: 404 })
  }
  const teacher = profile as { id: string; role?: string | null; account_status?: string | null }
  if (!INVITE_ROLES.includes(teacher.role as (typeof INVITE_ROLES)[number])) {
    return NextResponse.json({ error: 'Only instructors and resource people can be invited.' }, { status: 400 })
  }
  if (teacher.account_status && teacher.account_status !== 'active') {
    return NextResponse.json({ error: 'That teacher account is not active yet.' }, { status: 400 })
  }
  if (teacher.id === rbac.userId) {
    return NextResponse.json({ error: 'You are already on this course.' }, { status: 400 })
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
