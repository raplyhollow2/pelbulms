// @ts-nocheck - expansion tables not fully in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'

const TEACHER_ROLES = ['instructor', 'admin', 'resource_person', 'superadmin'] as const

function zipStore(files: Array<{ name: string; data: string }>): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: number[] = []
  const central: number[] = []
  let offset = 0

  const u16 = (n: number) => [n & 255, (n >> 8) & 255]
  const u32 = (n: number) => [...u16(n & 65535), ...u16((n >>> 16) & 65535)]

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.data)
    const local = [
      0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(0),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      0, 0,
    ]
    chunks.push(...local, ...name, ...data)
    const hdr = [
      0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(0),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(offset),
    ]
    central.push(...hdr, ...name)
    offset += local.length + name.length + data.length
  }

  const end = [
    0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0,
    ...u16(files.length),
    ...u16(files.length),
    ...u32(central.length),
    ...u32(offset),
    0, 0,
  ]
  return Uint8Array.from([...chunks, ...central, ...end])
}

export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess) {
    return NextResponse.json({ error: rbac.error || 'Access denied' }, { status: 403 })
  }
  const courseId = request.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId!, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: course } = await service.from('courses').select('title, description').eq('id', courseId).single()
  const { data: modules } = await service
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index')

  const items: string[] = []
  let html = `<html><head><meta charset="utf-8"><title>${(course as any)?.title}</title></head><body>`
  html += `<h1>${(course as any)?.title}</h1><p>${(course as any)?.description || ''}</p>`
  for (const mod of modules || []) {
    html += `<h2>${(mod as any).title}</h2>`
    const { data: lessons } = await service
      .from('lessons')
      .select('title, description, order_index')
      .eq('module_id', (mod as any).id)
      .order('order_index')
    for (const les of lessons || []) {
      html += `<h3>${(les as any).title}</h3><p>${(les as any).description || ''}</p>`
      items.push(`<item identifier="I${items.length}" identifierref="R${items.length}"><title>${escapeXml((les as any).title)}</title></item>`)
    }
  }
  html += '</body></html>'

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="pelbu-${courseId}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
  <organizations default="ORG1"><organization identifier="ORG1"><title>${escapeXml((course as any)?.title || 'Course')}</title>
  ${items.join('\n')}
  </organization></organizations>
  <resources><resource identifier="R0" type="webcontent" href="index.html"><file href="index.html"/></resource></resources>
</manifest>`

  const zip = zipStore([
    { name: 'imsmanifest.xml', data: manifest },
    { name: 'index.html', data: html },
  ])

  return new NextResponse(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="pelbu-scorm-${courseId}.zip"`,
    },
  })
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}
