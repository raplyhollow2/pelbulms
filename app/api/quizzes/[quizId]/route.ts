// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { courseInstructorByQuiz, canManageCourse } from '@/lib/authoring'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

async function authorize(request: NextRequest, quizId: string) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) return { ok: false as const, status: rbac.error?.includes('Unauthorized') ? 401 : 403, error: rbac.error || 'Access denied' }
  const service = await createServiceClient()
  const instructorId = await courseInstructorByQuiz(service, quizId)
  if (!instructorId) return { ok: false as const, status: 404, error: 'Quiz not found' }
  if (!canManageCourse(rbac.userRole, instructorId, rbac.userId!)) {
    return { ok: false as const, status: 403, error: 'You do not own this course' }
  }
  return { ok: true as const, service }
}

/** PATCH /api/quizzes/[quizId] -> update quiz fields. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title.trim()
  if ('description' in body) patch.description = body.description || null
  if (Number.isFinite(body.passingScore)) patch.passing_score = body.passingScore
  if (Number.isFinite(body.maxAttempts)) patch.max_attempts = body.maxAttempts
  if ('timeLimitMinutes' in body) patch.time_limit_minutes = Number.isFinite(body.timeLimitMinutes) ? body.timeLimitMinutes : null
  if (typeof body.isPublished === 'boolean') patch.is_published = body.isPublished

  const { data, error } = await auth.service.from('quizzes').update(patch).eq('id', quizId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ quiz: data })
}

/** DELETE /api/quizzes/[quizId] -> delete quiz (questions cascade). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params
  const auth = await authorize(request, quizId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.service.from('quizzes').delete().eq('id', quizId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
