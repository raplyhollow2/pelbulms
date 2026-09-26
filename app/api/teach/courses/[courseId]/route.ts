import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { getRequestUser } from '@/lib/request-user'
import { canAccessAdmin, canAccessTeaching } from '@/lib/roles'

/**
 * DELETE /api/teach/courses/[courseId]
 * Course owner (teacher) or admin/superadmin. Related rows cascade.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await createSupabaseServerClient()
  const admin = await tryCreateServiceClient()
  const db = admin || session

  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (profile as { role?: string } | null)?.role || user.role

  if (!canAccessTeaching(role)) {
    return NextResponse.json(
      { error: 'Only teachers and superadmins can delete courses' },
      { status: 403 }
    )
  }

  const { data: course } = await db
    .from('courses')
    .select('id, instructor_id')
    .eq('id', courseId)
    .maybeSingle()

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const isOwner = (course as { instructor_id?: string | null }).instructor_id === user.id
  if (!isOwner && !canAccessAdmin(role)) {
    return NextResponse.json({ error: 'You can only delete your own courses' }, { status: 403 })
  }

  const { error } = await db.from('courses').delete().eq('id', courseId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
