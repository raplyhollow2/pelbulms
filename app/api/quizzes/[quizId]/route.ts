// @ts-nocheck - quiz tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { getDbClient } from '@/lib/db'
import { authorizeQuizManage } from '@/lib/authoring'
import { courseIdByQuiz } from '@/lib/authoring'
import { notifyEnrolledStudents } from '@/lib/notify-enrolled'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

async function authorize(request: NextRequest, quizId: string) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return {
      ok: false as const,
      status: rbac.error?.includes('Unauthorized') ? 401 : 403,
      error: rbac.error || 'Access denied',
    }
  }
  const db = await getDbClient()
  const managed = await authorizeQuizManage(db, quizId, rbac.userId!, rbac.userRole)
  if (!managed.ok) return { ok: false as const, status: managed.status, error: managed.error }
  return { ok: true as const, db }
}

/** GET /api/quizzes/[quizId] -> quiz row. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params
    const auth = await authorize(request, quizId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { data, error } = await auth.db.from('quizzes').select('*').eq('id', quizId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    return NextResponse.json({ quiz: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load quiz' }, { status: 500 })
  }
}

/** PATCH /api/quizzes/[quizId] -> update quiz fields. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
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
    if ('timeLimitMinutes' in body) {
      patch.time_limit_minutes = Number.isFinite(body.timeLimitMinutes)
        ? body.timeLimitMinutes
        : null
    }
    if (typeof body.isPublished === 'boolean') patch.is_published = body.isPublished

    const { data, error } = await auth.db
      .from('quizzes')
      .update(patch)
      .eq('id', quizId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const courseId = await courseIdByQuiz(auth.db, quizId)
    if (courseId) {
      const lessonId = (data as any)?.lesson_id
      void notifyEnrolledStudents(auth.db, {
        courseId,
        type: 'activity_update',
        title: 'Quiz updated',
        message: `The quiz “${(data as any)?.title || 'Quiz'}” was updated.`,
        actionUrl: lessonId
          ? `/learn/${courseId}/lesson/${lessonId}`
          : `/learn/${courseId}`,
      }).catch(() => {})
    }

    return NextResponse.json({ quiz: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update quiz' }, { status: 500 })
  }
}

/** DELETE /api/quizzes/[quizId] -> delete quiz (questions cascade). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params
    const auth = await authorize(request, quizId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error } = await auth.db.from('quizzes').delete().eq('id', quizId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete quiz' }, { status: 500 })
  }
}
