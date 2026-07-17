import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'course-media'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100MB
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']

async function ensureBucket(supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_VIDEO_BYTES,
    })
  }
}

/**
 * POST /api/courses/media
 * Upload a course featured image or preview video to storage.
 * Multipart form-data: { file: File, courseId?: string, kind?: 'image' | 'video' }
 * Instructors, admins and superadmins only.
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
    const courseId = (formData.get('courseId') as string | null) || 'misc'
    const kind = ((formData.get('kind') as string | null) || 'image') as 'image' | 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const isVideo = kind === 'video'
    const allowed = isVideo ? ALLOWED_VIDEO : ALLOWED_IMAGE
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES

    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        {
          error: isVideo
            ? 'Unsupported video type. Use MP4, WEBM, OGG or MOV.'
            : 'Unsupported image type. Use JPG, PNG, WEBP, AVIF or GIF.',
        },
        { status: 400 }
      )
    }

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${Math.round(maxBytes / (1024 * 1024))}MB.`,
        },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    await ensureBucket(supabase)

    const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'png')
    const path = `${courseId}/${kind}-${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, kind })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to upload media' },
      { status: 500 }
    )
  }
}
