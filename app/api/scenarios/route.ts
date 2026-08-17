// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseIdByLesson, userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
  const service = await createServiceClient()
  const { data } = await service
    .from('lesson_scenarios')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return NextResponse.json({ scenarios: data || [] })
}

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const { lessonId, title, nodes, isPublished } = body || {}
  if (!lessonId || !title) {
    return NextResponse.json({ error: 'lessonId and title are required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const courseId = await courseIdByLesson(service, lessonId)
  if (!courseId || !(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await service
    .from('lesson_scenarios')
    .insert({
      lesson_id: lessonId,
      title,
      nodes: nodes || [],
      is_published: Boolean(isPublished),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ scenario: data })
}
