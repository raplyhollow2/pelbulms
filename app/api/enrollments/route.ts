// @ts-nocheck
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { notifyTeacherOfEnrollment } from '@/lib/notify-teachers'

/**
 * POST /api/enrollments
 * Body: { courseId }
 * Enrolls the authenticated user and notifies the course instructor.
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

    const body = await request.json().catch(() => ({}))
    const courseId = body?.courseId as string | undefined
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const service = await createServiceClient()

    const { data: course } = await service
      .from('courses')
      .select('id, title, status, is_published')
      .eq('id', courseId)
      .maybeSingle()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const { data: existing } = await service
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: true,
        enrollmentId: existing.id,
      })
    }

    const { data: enrollment, error } = await service
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
        status: 'active',
        progress_percentage: 0,
      })
      .select('id')
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
      })
    } catch (notifyErr) {
      console.error('[enrollments] teacher notify failed:', notifyErr)
    }

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment?.id,
      courseTitle: course.title,
    })
  } catch (e) {
    console.error('[enrollments] POST error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
