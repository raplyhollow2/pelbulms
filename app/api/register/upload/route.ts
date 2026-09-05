import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BUCKET = 'kyc-documents'
const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const FIELDS = ['passport', 'cid']

/**
 * POST /api/register/upload
 * Uploads a KYC document (passport photo or CID photo) to a PRIVATE bucket and
 * returns the storage path. The path is stored on the registration; the image
 * is only ever revealed through /api/register/document (signed URL).
 * Multipart form-data: { file: File, field: 'passport' | 'cid' }
 *
 * Uses the signed-in user's session + storage RLS (owner folder = auth.uid()),
 * so local/dev works without SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const field = (formData.get('field') as string | null) || 'passport'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG or WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 8MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${field}-${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    // Return a short-lived preview URL for the uploader plus the stored path.
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10)

    return NextResponse.json({ path, previewUrl: signed?.signedUrl || null })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 })
  }
}
