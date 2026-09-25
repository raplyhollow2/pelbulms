import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { userCanManageCourse } from '@/lib/course-access'
import { getRequestUser } from '@/lib/request-user'

const BUCKET = 'assignment-submissions'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB
const ALLOWED = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]
const ALLOWED_EXT = /\.(pdf|ppt|pptx|doc|docx|txt|png|jpe?g|webp|xls|xlsx|zip)$/i

async function ensureBucket(
  admin: NonNullable<Awaited<ReturnType<typeof tryCreateServiceClient>>>
) {
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
    if (error) throw new Error(error.message || 'Failed to create assignment-submissions bucket')
  }
}

/**
 * POST /api/teach/courses/[courseId]/return-upload
 * Upload a graded/annotated return file for a student submission.
 * Form fields: file, lessonId, progressId?
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const session = await createSupabaseServerClient()
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await tryCreateServiceClient()
    const db = admin || session
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()

    const canManage = await userCanManageCourse(
      db,
      courseId,
      user.id,
      (profile as any)?.role
    )
    if (!canManage) {
      return NextResponse.json(
        { error: 'Only course staff can upload return files' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const lessonId = typeof formData.get('lessonId') === 'string' ? String(formData.get('lessonId')) : ''
    const progressId =
      typeof formData.get('progressId') === 'string' ? String(formData.get('progressId')) : ''

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Use PDF, PPT, Word, Excel, text, images, or ZIP.',
        },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 })
    }

    if (admin) {
      await ensureBucket(admin)
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const scope = progressId || user.id
    const path = `returns/${courseId}/${lessonId}/${scope}/${Date.now()}-${safeName}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const uploader = admin || session

    const { error: uploadError } = await uploader.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const {
      data: { publicUrl },
    } = uploader.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      url: publicUrl,
      fileName: file.name,
      size: file.size,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to upload return file' },
      { status: 500 }
    )
  }
}
