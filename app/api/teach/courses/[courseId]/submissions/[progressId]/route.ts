// @ts-nocheck - lesson_activity_progress not in generated Database types yet
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse, courseIdByLesson } from '@/lib/course-access'
import { reconcileLessonCourseCompletion } from '@/lib/lesson-completion-sync'

/**
 * PATCH /api/teach/courses/[courseId]/submissions/[progressId]
 * Body: {
 *   grade?: number|null,
 *   feedback?: string|null,
 *   returnFileUrl?: string|null,
 *   returnFileName?: string|null,
 *   returnUrl?: string|null,
 *   status?: 'graded'|'returned'|'submitted'|'late'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; progressId: string }> }
) {
  try {
    const { courseId, progressId } = await params
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const canManage = await userCanManageCourse(
      service,
      courseId,
      user.id,
      (profile as any)?.role
    )
    if (!canManage) {
      return NextResponse.json({ error: 'Only course staff can grade submissions' }, { status: 403 })
    }

    const { data: row } = await service
      .from('lesson_activity_progress')
      .select(
        'id, user_id, lesson_id, activity_id, status, grade, max_grade, feedback, return_file_url, return_file_name, return_url, response, submitted_at'
      )
      .eq('id', progressId)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const rowCourseId = await courseIdByLesson(service, (row as any).lesson_id)
    if (!rowCourseId || rowCourseId !== courseId) {
      return NextResponse.json({ error: 'Submission does not belong to this course' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if ('feedback' in body) {
      updates.feedback =
        typeof body.feedback === 'string' ? body.feedback.trim() || null : null
    }

    if ('returnFileUrl' in body || 'return_file_url' in body) {
      const raw = body.returnFileUrl ?? body.return_file_url
      updates.return_file_url =
        typeof raw === 'string' ? raw.trim() || null : null
    }

    if ('returnFileName' in body || 'return_file_name' in body) {
      const raw = body.returnFileName ?? body.return_file_name
      updates.return_file_name =
        typeof raw === 'string' ? raw.trim() || null : null
    }

    if ('returnUrl' in body || 'return_url' in body) {
      const raw = body.returnUrl ?? body.return_url
      const url = typeof raw === 'string' ? raw.trim() : ''
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { error: 'returnUrl must start with http:// or https://' },
          { status: 400 }
        )
      }
      updates.return_url = url || null
    }

    if ('grade' in body) {
      if (body.grade === null || body.grade === '') {
        updates.grade = null
      } else {
        const grade = Number(body.grade)
        if (Number.isNaN(grade)) {
          return NextResponse.json({ error: 'grade must be a number' }, { status: 400 })
        }
        const max = (row as any).max_grade
        if (typeof max === 'number' && grade > max) {
          return NextResponse.json(
            { error: `grade cannot exceed max grade (${max})` },
            { status: 400 }
          )
        }
        if (grade < 0) {
          return NextResponse.json({ error: 'grade cannot be negative' }, { status: 400 })
        }
        updates.grade = grade
      }
    }

    let nextStatus =
      typeof body.status === 'string' ? body.status : undefined
    if (
      nextStatus &&
      !['graded', 'returned', 'submitted', 'late', 'draft'].includes(nextStatus)
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const nextReturnFileUrl =
      'return_file_url' in updates
        ? (updates.return_file_url as string | null)
        : ((row as any).return_file_url as string | null)
    const nextReturnUrl =
      'return_url' in updates
        ? (updates.return_url as string | null)
        : ((row as any).return_url as string | null)
    const hasReturnMaterial = Boolean(nextReturnFileUrl || nextReturnUrl)

    // Default: returned when staff shares a file/URL; otherwise graded when scored
    if (!nextStatus) {
      if (hasReturnMaterial) {
        nextStatus = 'returned'
      } else if ('grade' in body && updates.grade != null) {
        nextStatus = 'graded'
      }
    }

    if (nextStatus) {
      updates.status = nextStatus
      if (nextStatus === 'graded' || nextStatus === 'returned') {
        updates.graded_at = new Date().toISOString()
        updates.graded_by = user.id
      }
    }

    const { data: updated, error } = await service
      .from('lesson_activity_progress')
      .update(updates)
      .eq('id', progressId)
      .select(
        'id, user_id, lesson_id, activity_id, status, grade, max_grade, feedback, return_file_url, return_file_name, return_url, graded_at, graded_by, submitted_at, response'
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let lessonCompleted: boolean | null = null
    try {
      await reconcileLessonCourseCompletion(
        service,
        (updated as any).user_id,
        (updated as any).lesson_id
      )
      const { data: lessonProgress } = await service
        .from('lesson_progress')
        .select('completed')
        .eq('user_id', (updated as any).user_id)
        .eq('lesson_id', (updated as any).lesson_id)
        .maybeSingle()
      lessonCompleted = Boolean((lessonProgress as any)?.completed)
    } catch (syncError) {
      console.error('[grading] completion sync failed:', syncError)
    }

    return NextResponse.json({ submission: updated, lessonCompleted })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to grade submission' },
      { status: 500 }
    )
  }
}
