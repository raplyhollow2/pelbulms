// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseInstructorByLesson, canManageCourse } from '@/lib/authoring'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

/**
 * GET /api/quizzes?lessonId=... -> list quizzes (with question count) for a lesson.
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: rbac.error?.includes('Unauthorized') ? 401 : 403 })
  }

  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })

  const service = await createServiceClient()
  const instructorId = await courseInstructorByLesson(service, lessonId)
  if (!canManageCourse(rbac.userRole, instructorId, rbac.userId!)) {
    return NextResponse.json({ error: 'You do not own this course' }, { status: 403 })
  }

  const { data, error } = await service
    .from('quizzes')
    .select('*, quiz_questions(count)')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ quizzes: data || [] })
}

/**
 * POST /api/quizzes -> create a quiz on a lesson.
 * Body: { lessonId, title, description?, passingScore?, maxAttempts?, timeLimitMinutes?, isPublished? }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: rbac.error?.includes('Unauthorized') ? 401 : 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { lessonId, title, description, passingScore, maxAttempts, timeLimitMinutes, isPublished } = body || {}
  if (!lessonId || !title?.trim()) {
    return NextResponse.json({ error: 'lessonId and title are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const instructorId = await courseInstructorByLesson(service, lessonId)
  if (!instructorId) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  if (!canManageCourse(rbac.userRole, instructorId, rbac.userId!)) {
    return NextResponse.json({ error: 'You do not own this course' }, { status: 403 })
  }

  const { data, error } = await service
    .from('quizzes')
    .insert({
      lesson_id: lessonId,
      title: title.trim(),
      description: description || null,
      passing_score: Number.isFinite(passingScore) ? passingScore : 70,
      max_attempts: Number.isFinite(maxAttempts) ? maxAttempts : 3,
      time_limit_minutes: Number.isFinite(timeLimitMinutes) ? timeLimitMinutes : null,
      is_published: Boolean(isPublished),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ quiz: data })
}
