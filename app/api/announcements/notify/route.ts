import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyAllStudents, notifyEnrolledStudents } from '@/lib/notify-enrolled'
import { userCanManageCourse } from '@/lib/course-access'
import { getEmailTemplate } from '@/lib/email/templated'
import { ANNOUNCEMENT_MESSAGE_CAP, isGlobalCourse } from '@/lib/announcements'

export const maxDuration = 300

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

export async function POST(request: NextRequest) {
  const rbac = await enforceCapability(
    request,
    CAP.MODULE_ANNOUNCEMENTS_CONFIGURE,
    [...TEACHER_ROLES]
  )
  if (!rbac.hasAccess || !rbac.userId) return denied(rbac)

  try {
    const body = await request.json().catch(() => null)
    const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : ''
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 500) : ''
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, ANNOUNCEMENT_MESSAGE_CAP) : ''
    const templateKey = typeof body?.emailTemplate === 'string' ? body.emailTemplate.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'A title is required' }, { status: 400 })
    }

    if (templateKey) {
      const template = await getEmailTemplate(templateKey)
      if (!template) {
        return NextResponse.json({ error: 'Email template not found' }, { status: 404 })
      }
      if (!template.enabled) {
        return NextResponse.json({ error: 'This email template is turned off' }, { status: 400 })
      }
    }

    const service = await createServiceClient()
    const global = isGlobalCourse(courseId)

    if (!global) {
      const allowed = await userCanManageCourse(service, courseId, rbac.userId, rbac.userRole)
      if (!allowed) {
        return NextResponse.json({ error: 'You cannot announce to this course' }, { status: 403 })
      }
      const count = await notifyEnrolledStudents(service, {
        courseId,
        title,
        message,
        actionUrl: '/announcements',
        type: 'announcement',
        emailTemplate: templateKey || null,
      })
      return NextResponse.json({ notified: count })
    }

    if (!templateKey) {
      return NextResponse.json({ notified: 0 })
    }

    if (rbac.userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only a superadmin can email every student from a global announcement' },
        { status: 403 }
      )
    }

    const count = await notifyAllStudents(service, {
      title,
      message,
      actionUrl: '/announcements',
      emailTemplate: templateKey,
    })
    return NextResponse.json({ notified: count })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to notify students'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
