// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse, listCourseStaffIds } from '@/lib/course-access'

/**
 * GET /api/courses/[courseId]/discussion/members
 * Enrolled learners + course staff available for tagging (course-scoped).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const session = await createSupabaseServerClient()
    const {
      data: { user },
    } = await session.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await tryCreateServiceClient()
    const db = admin || session
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role || null

    const canManage = await userCanManageCourse(db, courseId, user.id, role as any)
    const { data: enrollment } = await db
      .from('enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .in('status', ['active', 'completed'])
      .limit(1)
      .maybeSingle()

    if (!canManage && !enrollment) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: enrollments } = await db
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .in('status', ['active', 'completed'])

    const staffIds = await listCourseStaffIds(db, courseId)
    const ids = [
      ...new Set([
        ...(enrollments || []).map((e: any) => e.user_id).filter(Boolean),
        ...staffIds,
      ]),
    ].filter((id) => id !== user.id)

    if (ids.length === 0) return NextResponse.json({ members: [] })

    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)
      .order('full_name', { ascending: true })

    const members = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || 'Learner',
      avatar_url: p.avatar_url || null,
    }))

    return NextResponse.json({ members })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load members' }, { status: 500 })
  }
}
