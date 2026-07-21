import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'lesson-resources'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB per file
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
]

async function ensureBucket(supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
    if (error) throw new Error(error.message || 'Failed to create lesson-resources bucket')
  }
}

/**
 * POST /api/courses/resources
 * Upload a PDF/PPT/doc reading material for a lesson.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['instructor', 'admin', 'resource_person', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const courseId = (formData.get('courseId') as string) || 'misc'
    const lessonId = (formData.get('lessonId') as string) || 'misc'
    const title = (formData.get('title') as string) || file?.name || 'Resource'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type) && !/\.(pdf|ppt|pptx|doc|docx|txt|png|jpe?g|webp|xls|xlsx)$/i.test(file.name)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, PPT, Word, Excel, text, or images.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    await ensureBucket(supabase)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${courseId}/${lessonId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type || `application/${ext}`, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      resource: {
        title,
        url: publicUrl,
        type: file.type || ext,
        size: file.size,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to upload resource' },
      { status: 500 }
    )
  }
}
