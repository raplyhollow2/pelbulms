import { NextResponse } from 'next/server'
import { userCanManageCourse } from '@/lib/course-access'
import { getRequestUser } from '@/lib/request-user'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/teach/courses/[courseId]/preview-access
 * Course staff may open the learner lesson without an enrollment.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ preview: false }, { status: 401 })

  const session = await createSupabaseServerClient()
  const admin = await tryCreateServiceClient()
  const db = admin || session

  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (profile as { role?: string } | null)?.role || user.role

  const preview = await userCanManageCourse(db as any, courseId, user.id, role as any)
  return NextResponse.json({ preview })
}
