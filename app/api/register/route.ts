// @ts-nocheck - student_registrations columns not fully in generated Database types
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceClient } from '@/lib/supabase/server'

const PHONE_RE = /^\+975[0-9]{8}$/
const CID_RE = /^[0-9]{11}$/
const REQUESTABLE_ROLES = ['student', 'instructor', 'resource_person']

/**
 * GET /api/register
 * Returns the list of institutions to pick from and the caller's current
 * registration status (so the page can decide what to show).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  const shortLabel = (i: { name?: string; slug?: string; display_name?: string | null }) => {
    if (i.display_name?.trim()) return i.display_name.trim()
    if (i.slug === 'pelsung') return 'Pelsung'
    const name = (i.name || '').trim()
    if (name.includes(' - ')) return name.split(' - ')[0].trim()
    return name || i.slug || 'Institution'
  }

  let institutions: any[] | null = null
  {
    const withDisplay = await service
      .from('institutions')
      .select('id, name, slug, display_name')
      .order('name', { ascending: true })
    if (!withDisplay.error) {
      institutions = withDisplay.data
    } else {
      const fallback = await service
        .from('institutions')
        .select('id, name, slug')
        .order('name', { ascending: true })
      institutions = fallback.data
    }
  }

  const institutionsForUi = (institutions || []).map((i: any) => ({
    id: i.id,
    slug: i.slug,
    name: shortLabel(i),
    display_name: shortLabel(i),
  }))

  const { data: registration } = await service
    .from('student_registrations')
    .select('id, registration_status, institution_id, review_notes, rejection_reason')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await service
    .from('profiles')
    .select('account_status, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || '' },
    institutions: institutionsForUi,
    registration: registration || null,
    account_status: profile?.account_status || 'pending',
  })
}

/**
 * POST /api/register
 * Submit (or resubmit) the Bhutan KYC registration form. Writes with the
 * service client so the profiles-update RLS lock from migration 023 does not
 * block a legitimate first submission. Leaves the account 'pending' until an
 * assigned reviewer approves.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    full_name,
    phone_number,
    cid_number,
    passport_photo_url,
    cid_photo_url,
    institution_id,
    requested_role,
    date_of_birth,
    gender,
    village,
    gewog,
    dzongkhag,
    class: className,
    education_level,
    parent_guardian_name,
    parent_guardian_phone,
    motivation_statement,
  } = body || {}

  // Required-field validation.
  const missing: string[] = []
  if (!full_name?.trim()) missing.push('full_name')
  if (!phone_number?.trim()) missing.push('phone_number')
  if (!cid_number?.trim()) missing.push('cid_number')
  if (!passport_photo_url?.trim()) missing.push('passport_photo_url')
  if (!cid_photo_url?.trim()) missing.push('cid_photo_url')
  if (!institution_id?.trim()) missing.push('institution_id')
  if (!gewog?.trim()) missing.push('gewog')
  if (!dzongkhag?.trim()) missing.push('dzongkhag')

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  if (!PHONE_RE.test(phone_number)) {
    return NextResponse.json(
      { error: 'Phone must be in the format +975 followed by 8 digits.' },
      { status: 400 }
    )
  }

  if (!CID_RE.test(cid_number)) {
    return NextResponse.json(
      { error: 'CID number must be exactly 11 digits.' },
      { status: 400 }
    )
  }

  const role = REQUESTABLE_ROLES.includes(requested_role) ? requested_role : 'student'

  const service = await createServiceClient()

  const payload = {
    user_id: user.id,
    institution_id,
    full_name: full_name.trim(),
    email: user.email,
    phone_number: phone_number.trim(),
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    cid_number: cid_number.trim(),
    passport_photo_url,
    cid_photo_url,
    requested_role: role,
    class: className || null,
    education_level: education_level || null,
    village: village || null,
    gewog: gewog.trim(),
    dzongkhag: dzongkhag.trim(),
    parent_guardian_name: parent_guardian_name || null,
    parent_guardian_phone: parent_guardian_phone || null,
    motivation_statement: motivation_statement || null,
    registration_status: 'submitted',
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await service
    .from('student_registrations')
    .upsert(payload, { onConflict: 'user_id,institution_id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  // Keep the account pending + attach the institution so the gate routes them
  // to the pending page (not back to the form).
  await service
    .from('profiles')
    .update({
      account_status: 'pending',
      institution_id,
      full_name: full_name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  return NextResponse.json({ success: true, message: 'Registration submitted for review.' })
}
