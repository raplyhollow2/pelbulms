// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { fetchLinkPreview } from '@/lib/link-preview'

async function assertCourseAccess(courseId: string, userId: string, role?: string | null) {
  const admin = await tryCreateServiceClient()
  const db = admin || (await createSupabaseServerClient())
  if (await userCanManageCourse(db, courseId, userId, role as any)) return true
  const { data } = await db
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

/**
 * GET /api/courses/[courseId]/discussion/link-preview?url=
 * Open Graph preview for URLs pasted into course discussion (enrolled only).
 */
export async function GET(
  request: NextRequest,
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
    if (!(await assertCourseAccess(courseId, user.id, profile?.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

    const preview = await fetchLinkPreview(url)
    if (!preview) return NextResponse.json({ error: 'Could not load preview' }, { status: 400 })
    return NextResponse.json({ preview })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Preview failed' }, { status: 500 })
  }
}
