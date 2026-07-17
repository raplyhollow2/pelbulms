// @ts-nocheck - registration_reviewers not in generated Database types
import { NextRequest, NextResponse } from 'next/server'
import { checkRBAC } from '@/lib/rbac'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/reviewers
 * Superadmin only. Returns institutions, current active reviewers, and a list
 * of candidate users who can be assigned as reviewers.
 */
export async function GET(request: NextRequest) {
  const rbac = await checkRBAC(request, ['superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  const service = await createServiceClient()

  const { data: institutions } = await service
    .from('institutions')
    .select('id, name')
    .order('name')

  const { data: reviewers } = await service
    .from('registration_reviewers')
    .select('id, user_id, institution_id, is_active, created_at')
    .eq('is_active', true)

  const { data: candidates } = await service
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['instructor', 'resource_person', 'admin'])
    .order('full_name')

  // Attach profile info to reviewer rows.
  const byId = new Map((candidates || []).map((c: any) => [c.id, c]))
  const enrichedReviewers = (reviewers || []).map((r: any) => ({
    ...r,
    profile: byId.get(r.user_id) || null,
  }))

  return NextResponse.json({
    institutions: institutions || [],
    reviewers: enrichedReviewers,
    candidates: candidates || [],
  })
}

/**
 * POST /api/admin/reviewers
 * Superadmin only. Body: { action: 'assign' | 'revoke', userId, institutionId }
 */
export async function POST(request: NextRequest) {
  const rbac = await checkRBAC(request, ['superadmin'])
  if (!rbac.hasAccess) {
    return NextResponse.json(
      { error: rbac.error || 'Access denied' },
      { status: rbac.error?.includes('Unauthorized') ? 401 : 403 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { action, userId, institutionId } = body || {}
  if (!action || !userId || !institutionId) {
    return NextResponse.json({ error: 'action, userId and institutionId are required' }, { status: 400 })
  }

  const service = await createServiceClient()

  if (action === 'assign') {
    const { error } = await service
      .from('registration_reviewers')
      .upsert(
        { user_id: userId, institution_id: institutionId, assigned_by: rbac.userId, is_active: true },
        { onConflict: 'user_id,institution_id' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'revoke') {
    const { error } = await service
      .from('registration_reviewers')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('institution_id', institutionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
