import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessTeaching } from '@/lib/rbac'

const BUCKET = 'kyc-documents'

/**
 * GET /api/register/document?path=<storage-path>
 * Returns a short-lived signed URL (302 redirect) for a private KYC document.
 * Access: the owner (path is namespaced by their user id) OR a reviewer
 * (teacher/resource_person/admin/superadmin).
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const path = request.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const service = await createServiceClient()

  const isOwner = path.startsWith(`${user.id}/`)
  let allowed = isOwner

  if (!allowed) {
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    allowed = canAccessTeaching((profile as any)?.role)

    // Assigned registration reviewers (non-teacher helpers) also need KYC previews
    if (!allowed) {
      const { data: reviewerRows } = await service
        .from('registration_reviewers')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
      allowed = !!(reviewerRows && reviewerRows.length > 0)
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 5)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
