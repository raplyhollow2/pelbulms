import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { notifyStudentOfEnrollmentDecision } from '@/lib/notify-enrolled'

async function assertCourseStaff(
  service: any,
  userId: string,
  courseId: string
): Promise<{ ok: true; isOwner: boolean; isStaff: boolean } | { ok: false; response: NextResponse }> {
  const { data: course } = await service
    .from('courses')
    .select('id, title, instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) {
    return { ok: false, response: NextResponse.json({ error: 'Course not found' }, { status: 404 }) }
  }
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const role = (profile as any)?.role
  const isOwner = (course as any).instructor_id === userId
  const isStaff = role === 'admin' || role === 'superadmin'
  const { data: staffRow } = await service
    .from('course_instructors')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!isOwner && !isStaff && !staffRow) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Only course staff can view enrollments' }, { status: 403 }),
    }
  }
  return { ok: true, isOwner, isStaff }
}

/**
 * GET /api/teach/enrollments?courseId=
 * Identity snapshot for the roster (CID, institution) from approved KYC.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const courseId = new URL(request.url).searchParams.get('courseId')
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const service = await createServiceClient()
    const access = await assertCourseStaff(service, user.id, courseId)
    if (!access.ok) return access.response

    const { data: enrollments } = await service
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId)

    const userIds = Array.from(new Set((enrollments || []).map((e: any) => e.user_id).filter(Boolean)))
    if (userIds.length === 0) {
      return NextResponse.json({ identities: {} })
    }

    const { data: regs } = await service
      .from('student_registrations')
      .select('user_id, cid_number, dzongkhag, gewog, institution_id, registration_status')
      .in('user_id', userIds)
      .eq('registration_status', 'approved')

    const institutionIds = Array.from(
      new Set((regs || []).map((r: any) => r.institution_id).filter(Boolean))
    )
    let instNames: Record<string, string> = {}
    if (institutionIds.length) {
      const { data: insts } = await service
        .from('institutions')
        .select('id, name, display_name')
        .in('id', institutionIds)
      for (const i of insts || []) {
        instNames[i.id] = i.display_name || i.name
      }
    }

    const identities: Record<
      string,
      { cid_number: string | null; dzongkhag: string | null; gewog: string | null; institution: string | null }
    > = {}
    for (const r of regs || []) {
      identities[r.user_id] = {
        cid_number: r.cid_number || null,
        dzongkhag: r.dzongkhag || null,
        gewog: r.gewog || null,
        institution: r.institution_id ? instNames[r.institution_id] || null : null,
      }
    }

    return NextResponse.json({ identities })
  } catch (e) {
    console.error('[teach/enrollments] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/teach/enrollments
 * Body: { enrollmentId, action: 'approve' | 'reject' }
 * Course creator (or admin/superadmin) verifies pending enrollments.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const enrollmentId = body.enrollmentId as string | undefined
    const action = body.action as string | undefined
    if (!enrollmentId || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { error: 'enrollmentId and action (approve|reject) are required' },
        { status: 400 }
      )
    }

    const service = await createServiceClient()

    const { data: enrollment, error: enrollError } = await service
      .from('enrollments')
      .select('id, user_id, course_id, status')
      .eq('id', enrollmentId)
      .maybeSingle()

    if (enrollError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const { data: course } = await service
      .from('courses')
      .select('id, title, instructor_id')
      .eq('id', (enrollment as any).course_id)
      .maybeSingle()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = (profile as any)?.role
    const isOwner = (course as any).instructor_id === user.id
    const isStaff = role === 'admin' || role === 'superadmin'
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Only the course creator can verify enrollments' }, { status: 403 })
    }

    if ((enrollment as any).status !== 'pending' && action === 'approve') {
      // Allow re-activate if somehow rejected? only pending for now
      if ((enrollment as any).status === 'active') {
        return NextResponse.json({ success: true, alreadyActive: true })
      }
    }

    const nextStatus = action === 'approve' ? 'active' : 'rejected'
    const { data: updated, error: updateError } = await service
      .from('enrollments')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        ...(action === 'approve'
          ? { enrolled_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', enrollmentId)
      .select('id, status')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    try {
      await notifyStudentOfEnrollmentDecision(service, {
        courseId: (course as any).id,
        courseTitle: (course as any).title,
        studentId: (enrollment as any).user_id,
        approved: action === 'approve',
      })
    } catch (e) {
      console.error('[teach/enrollments] notify student failed:', e)
    }

    return NextResponse.json({ success: true, enrollment: updated })
  } catch (e) {
    console.error('[teach/enrollments] PATCH error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
