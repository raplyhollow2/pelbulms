import { NextRequest, NextResponse } from 'next/server'
import { enforceCapability, CAP } from '@/lib/rbac'
import { announcementTemplateUsesCopy } from '@/lib/announcements'
import { listEmailTemplates } from '@/lib/email/templated'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

function denied(rbac: { error?: string }) {
  return NextResponse.json(
    { error: rbac.error || 'Access denied' },
    { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
  )
}

export async function GET(request: NextRequest) {
  const rbac = await enforceCapability(
    request,
    CAP.MODULE_ANNOUNCEMENTS_CONFIGURE,
    [...TEACHER_ROLES]
  )
  if (!rbac.hasAccess) return denied(rbac)

  const templates = await listEmailTemplates()
  return NextResponse.json({
    canEmailAllStudents: rbac.userRole === 'superadmin',
    templates: templates
      .filter((item) => item.enabled)
      .map((item) => ({
        key: item.key,
        label: item.label,
        description: item.description,
        variables: item.variables,
        usesAnnouncementCopy: announcementTemplateUsesCopy(item),
      })),
  })
}
