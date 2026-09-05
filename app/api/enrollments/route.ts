// @ts-nocheck
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getDbClient } from '@/lib/db'
import { notifyTeacherOfEnrollment } from '@/lib/notify-teachers'

/**
 * POST /api/enrollments
 * Body: { courseId }
 * Enrolls the authenticated user.
 * - enrollment_mode=approval (default) → status pending until creator verifies
 * - enrollment_mode=auto → status active immediately
 *
 * Uses service_role when available; falls back to the user session so local
 * dev works without SUPABASE_SERVICE_ROLE_KEY (RLS allows self-enroll).
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

    const service = await getDbClient()

    let accountStatus =
      (user.app_metadata as any)?.account_status ||
      (user.user_metadata as any)?.account_status ||
      null

    if (!accountStatus) {
      const { data: profile } = await service
        .from('profiles')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle()
      accountStatus = (profile as any)?.account_status || null
    }

    // Only hard-block rejected/suspended accounts; KYC pending no longer blocks enroll.
    if (accountStatus === 'rejected' || accountStatus === 'suspended') {
      return NextResponse.json(
        {
          error: 'Your account cannot enroll in courses. Contact support if you believe this is an error.',
          accountStatus,
        },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const courseId = body?.courseId as string | undefined
    const inviteCode = typeof body?.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : ''
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

    const mode = ((course as any).enrollment_mode as string) || 'approval'
    const requiresApproval = mode === 'approval'
    const requiresInvite = mode === 'invite_code'
    const requiresPaid = mode === 'paid'

    const stripeSessionId =
      typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''

    if (requiresPaid) {
      if (!process.env.STRIPE_SECRET_KEY || !stripeSessionId) {
        return NextResponse.json(
          {
            error: 'This course requires payment before enrollment.',
            enrollmentMode: 'paid',
          },
          { status: 402 }
        )
      }
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSessionId)}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
      )
      const session = await stripeRes.json().catch(() => ({}))
      const paid =
        session?.payment_status === 'paid' &&
        session?.metadata?.courseId === courseId &&
        session?.metadata?.userId === user.id
      if (!paid) {
        return NextResponse.json(
          { error: 'Payment is incomplete or does not match this course.', enrollmentMode: 'paid' },
          { status: 402 }
        )
      }
    }

    let matchedInvite: { id: string } | null = null
    if (requiresInvite) {
      if (!inviteCode) {
        return NextResponse.json(
          { error: 'This course requires a unique enrollment code from your teacher.' },
          { status: 400 }
        )
      }
      const { data: invite } = await service
        .from('enrollment_invites')
        .select('id, used_at, expires_at, student_email, student_phone')
        .eq('course_id', courseId)
        .eq('code', inviteCode)
        .maybeSingle()
      if (!invite) {
        return NextResponse.json({ error: 'Invalid enrollment code.' }, { status: 400 })
      }
      if ((invite as any).used_at) {
        return NextResponse.json({ error: 'This enrollment code has already been used.' }, { status: 400 })
      }
      if ((invite as any).expires_at && new Date((invite as any).expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'This enrollment code has expired.' }, { status: 400 })
      }
      matchedInvite = { id: (invite as any).id }
    }

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
        if (matchedInvite) {
          await service
            .from('enrollment_invites')
            .update({
              used_at: new Date().toISOString(),
              used_by: user.id,
            })
            .eq('id', matchedInvite.id)
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

    if (matchedInvite) {
      await service
        .from('enrollment_invites')
        .update({
          used_at: new Date().toISOString(),
          used_by: user.id,
        })
        .eq('id', matchedInvite.id)
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
