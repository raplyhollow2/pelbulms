// @ts-nocheck
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { notifyTeacherOfEnrollment } from '@/lib/notify-teachers'

/**
 * POST /api/enrollments
 * Body: { courseId }
 * Enrolls the authenticated verified user.
 * - enrollment_mode=auto → status active immediately
 * - enrollment_mode=approval → status pending until creator verifies
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Paid LMS membership: require verified (active) account — no course fee
    let accountStatus =
      (user.app_metadata as any)?.account_status ||
      (user.user_metadata as any)?.account_status ||
      null

    const service = await createServiceClient()

    if (!accountStatus) {
      const { data: profile } = await service
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle()
      accountStatus = (profile as any)?.account_status || null
    }

    if (accountStatus && accountStatus !== 'active') {
      return NextResponse.json(
        {
          error:
            accountStatus === 'pending' || accountStatus === 'submitted'
              ? 'Your account is awaiting verification. You can enroll after approval.'
              : 'Your account is not verified. Contact support or complete registration review.',
          accountStatus,
        },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const courseId = body?.courseId as string | undefined
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const { data: course, error: courseLookupError } = await service
      .from('courses')
      .select('id, title, is_published, enrollment_mode, instructor_id')
      .eq('id', courseId)
      .maybeSingle()

    if (courseLookupError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (!(course as any).is_published) {
      return NextResponse.json({ error: 'This course is not published yet' }, { status: 400 })
    }

    const mode = ((course as any).enrollment_mode as string) || 'auto'
    const requiresApproval = mode === 'approval'

    const { data: existing } = await service
      .from('enrollments')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (existing) {
      const status = (existing as any).status
      if (status === 'active') {
        return NextResponse.json({
          success: true,
          alreadyEnrolled: true,
          status: 'active',
          enrollmentId: existing.id,
        })
      }
      if (status === 'pending') {
        return NextResponse.json({
          success: true,
          pending: true,
          status: 'pending',
          enrollmentId: existing.id,
          message: 'Your enrollment request is waiting for the course creator to approve.',
        })
      }
      // Rejected → allow re-request
      if (status === 'rejected' && requiresApproval) {
        const { data: updated, error: reReqError } = await service
          .from('enrollments')
          .update({
            status: 'pending',
            progress_percentage: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id, status')
          .single()
        if (reReqError) {
          return NextResponse.json({ error: reReqError.message }, { status: 400 })
        }
        try {
          await notifyTeacherOfEnrollment(service, {
            courseId,
            studentId: user.id,
            pending: true,
          })
        } catch (notifyErr) {
          console.error('[enrollments] teacher notify failed:', notifyErr)
        }
        return NextResponse.json({
          success: true,
          pending: true,
          status: 'pending',
          enrollmentId: updated?.id,
          message: 'Enrollment request sent. The course creator will verify your request.',
        })
      }
      // Rejected + auto mode → activate
      if (status === 'rejected' && !requiresApproval) {
        const { data: updated, error: reactivateError } = await service
          .from('enrollments')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
            enrolled_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('id, status')
          .single()
        if (reactivateError) {
          return NextResponse.json({ error: reactivateError.message }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          status: 'active',
          enrollmentId: updated?.id,
        })
      }
    }

    const nextStatus = requiresApproval ? 'pending' : 'active'
    const { data: enrollment, error } = await service
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
        status: nextStatus,
        progress_percentage: 0,
      })
      .select('id, status')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, alreadyEnrolled: true })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    try {
      await notifyTeacherOfEnrollment(service, {
        courseId,
        studentId: user.id,
        pending: requiresApproval,
      })
    } catch (notifyErr) {
      console.error('[enrollments] teacher notify failed:', notifyErr)
    }

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment?.id,
      courseTitle: course.title,
      status: nextStatus,
      pending: requiresApproval,
      message: requiresApproval
        ? 'Enrollment request sent. The course creator will verify your request.'
        : undefined,
    })
  } catch (e) {
    console.error('[enrollments] POST error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
