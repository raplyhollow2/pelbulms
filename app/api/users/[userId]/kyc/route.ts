// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { CAP, enforceCapability, institutionAllowed } from '@/lib/capabilities'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'kyc-documents'
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const FIELDS = ['passport', 'cid']

/**
 * POST /api/users/:userId/kyc
 * Superadmin or user editor uploads a CID or identity photo for another account.
 * Multipart: { file, field: 'passport' | 'cid' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rbac = await enforceCapability(request, [CAP.USERS_EDIT], ['admin', 'superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  try {
    const { userId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const field = (formData.get('field') as string | null) || 'passport'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!FIELDS.includes(field)) return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG or WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 8MB.' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, institution_id')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!institutionAllowed(target.institution_id, rbac.capabilities)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${field}-${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const column = field === 'cid' ? 'cid_photo_url' : 'passport_photo_url'
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([path])
      const error = removeError
        ? `${profileError.message} The uploaded file could not be removed: ${removeError.message}`
        : profileError.message
      return NextResponse.json({ error }, { status: 400 })
    }

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10)
    return NextResponse.json({ path, field, previewUrl: signed?.signedUrl || null })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Upload failed' }, { status: 500 })
  }
}
