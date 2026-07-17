import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'avatars'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function ensureBucket(supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
  }
}

/**
 * POST /api/users/avatar
 * Upload a profile picture to storage and (optionally) attach it to a user.
 * Multipart form-data: { file: File, userId?: string }
 * Admins may set any user's avatar; other authenticated users only their own.
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['student', 'instructor', 'admin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const targetUserId = (formData.get('userId') as string | null) || rbac.userId!

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (targetUserId !== rbac.userId && rbac.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'You can only update your own avatar' },
        { status: 403 }
      )
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPG, PNG, WEBP or GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    await ensureBucket(supabase)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${targetUserId}/${Date.now()}.${ext}`
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

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ avatar_url: publicUrl, user: profile })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to upload avatar' },
      { status: 500 }
    )
  }
}
