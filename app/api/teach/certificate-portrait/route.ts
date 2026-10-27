// @ts-nocheck - course staff tables are not fully represented in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { TEACHER_ROLES } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { parseMediaRef } from '@/lib/media'
import { cloudinaryClient, getCloudinaryAccount, signedUrl } from '@/lib/cloudinary'

export const runtime = 'nodejs'

/**
 * POST /api/teach/certificate-portrait
 * Body: { courseId, userId }
 * Copies a course person's private avatar into a public certificate portrait.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, [...TEACHER_ROLES])
  if (!rbac.hasAccess || !rbac.userId) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const courseId = String(body.courseId || '').trim()
  const userId = String(body.userId || '').trim()
  if (!courseId || !userId) {
    return NextResponse.json({ error: 'courseId and userId are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  if (!(await userCanManageCourse(service, courseId, rbac.userId, rbac.userRole))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: course } = await service
    .from('courses')
    .select('instructor_id')
    .eq('id', courseId)
    .maybeSingle()
  const ownerId = (course as { instructor_id?: string } | null)?.instructor_id
  let onCourse = ownerId === userId
  if (!onCourse) {
    const { data: staff } = await service
      .from('course_instructors')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle()
    onCourse = Boolean(staff)
  }
  if (!onCourse) {
    return NextResponse.json({ error: 'That person is not on this course.' }, { status: 400 })
  }

  const { data: profile } = await service
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const avatar = (profile as { avatar_url?: string | null } | null)?.avatar_url?.trim()
  if (!avatar) {
    return NextResponse.json(
      { error: 'The account photo was not copied. This person has no profile photo.' },
      { status: 404 }
    )
  }

  try {
    const bytes = await readAvatarBytes(avatar)
    const account = await getCloudinaryAccount()
    if (!account) {
      return NextResponse.json({ error: 'The account photo was not copied.' }, { status: 503 })
    }
    const cloudinary = cloudinaryClient(account)
    const uploaded: { secure_url?: string } = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `course-media/images/${courseId}/certificate-portraits`,
            resource_type: 'image',
            type: 'upload',
            format: 'png',
            transformation: [
              {
                width: 512,
                height: 512,
                crop: 'fill',
                gravity: 'face',
                radius: 'max',
                background: 'transparent',
              },
            ],
          },
          (err, result) => (err ? reject(err) : resolve(result || {}))
        )
        .end(Buffer.from(bytes))
    })
    const url = uploaded.secure_url
    if (!url || !url.startsWith('https://')) {
      return NextResponse.json({ error: 'The account photo was not copied.' }, { status: 502 })
    }
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'The account photo was not copied.' }, { status: 502 })
  }
}

async function readAvatarBytes(avatar: string): Promise<Uint8Array> {
  const parsed = parseMediaRef(avatar)
  let url = avatar
  if (parsed) {
    const account = await getCloudinaryAccount()
    if (!account) throw new Error('Media backend not configured')
    url = signedUrl(parsed.publicId, account, {
      resourceType: parsed.type === 'video' ? 'video' : 'image',
      raw: true,
    })
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Unsupported avatar')
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read the account photo')
  return new Uint8Array(await response.arrayBuffer())
}
