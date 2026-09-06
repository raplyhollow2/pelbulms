import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAdmin, canAccessTeaching } from '@/lib/roles'

export type EnrollmentRequestRow = {
  enrollmentId: string
  courseId: string
  courseTitle: string
  studentName: string
  studentEmail: string | null
  requestedAt: string | null
}

/**
 * GET /api/teach/enrollment-requests
 * Pending enrollment queue for the Teach dashboard.
 * Creators see their courses; admin/superadmin see all.
 */
export async function GET() {
  try {
    const auth = await createSupabaseServerClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = (profile as any)?.role as string | undefined
    if (!canAccessTeaching(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isAdmin = canAccessAdmin(role)

    let courseIds: string[] | null = null
    if (!isAdmin) {
      const { data: owned } = await service
        .from('courses')
        .select('id')
        .eq('instructor_id', user.id)
      courseIds = (owned || []).map((c: any) => c.id).filter(Boolean)
      if (courseIds.length === 0) {
        return NextResponse.json({ requests: [] as EnrollmentRequestRow[] })
      }
    }

    let query = service
      .from('enrollments')
      .select('id, user_id, course_id, enrolled_at, updated_at')
      .eq('status', 'pending')
      .order('enrolled_at', { ascending: false })

    if (courseIds) {
      query = query.in('course_id', courseIds)
    }

    const { data: enrollments, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const rows = enrollments || []
    if (rows.length === 0) {
      return NextResponse.json({ requests: [] as EnrollmentRequestRow[] })
    }

    const uniqueCourseIds = Array.from(new Set(rows.map((e: any) => e.course_id).filter(Boolean)))
    const uniqueUserIds = Array.from(new Set(rows.map((e: any) => e.user_id).filter(Boolean)))

    const [{ data: courses }, { data: people }] = await Promise.all([
      service.from('courses').select('id, title').in('id', uniqueCourseIds),
      service.from('profiles').select('id, full_name, email').in('id', uniqueUserIds),
    ])

    const courseTitle: Record<string, string> = {}
    for (const c of courses || []) {
      courseTitle[c.id] = (c as any).title || 'Untitled course'
    }
    const person: Record<string, { full_name: string | null; email: string | null }> = {}
    for (const p of people || []) {
      person[p.id] = { full_name: (p as any).full_name || null, email: (p as any).email || null }
    }

    const requests: EnrollmentRequestRow[] = rows.map((e: any) => {
      const who = person[e.user_id]
      return {
        enrollmentId: e.id,
        courseId: e.course_id,
        courseTitle: courseTitle[e.course_id] || 'Untitled course',
        studentName: who?.full_name || who?.email || 'A student',
        studentEmail: who?.email || null,
        requestedAt: e.updated_at || e.enrolled_at || null,
      }
    })

    return NextResponse.json({ requests })
  } catch (e) {
    console.error('[teach/enrollment-requests] GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
