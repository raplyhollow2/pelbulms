import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyEnrolledStudents } from '@/lib/notify-enrolled'

export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const body = await request.json()
    const courseId = body.courseId as string
    const title = (body.title as string) || 'New announcement'
    const message = (body.message as string) || ''

    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const service = await createServiceClient()
    const count = await notifyEnrolledStudents(service, {
      courseId,
      title,
      message,
      actionUrl: `/announcements`,
      type: 'announcement',
    })

    return NextResponse.json({ notified: count })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to notify students' },
      { status: 500 }
    )
  }
}
