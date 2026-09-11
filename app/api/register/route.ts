// @ts-nocheck - student_registrations columns not fully in generated Database types
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, tryCreateServiceClient } from '@/lib/supabase/server'
import { getPlatformSettings, toRegistrationPolicy } from '@/lib/platform-settings'
import { autoActivateStudentAccount } from '@/lib/approve-registration'
import { isTeachingRequestRole } from '@/lib/kyc'

const PHONE_RE = /^\+975[0-9]{8}$/
const CID_RE = /^[0-9]{11}$/
const REQUESTABLE_ROLES = ['student', 'instructor', 'resource_person']

function shortLabel(i: { name?: string; slug?: string; display_name?: string | null }) {
  if (i.display_name?.trim()) return i.display_name.trim()
  if (i.slug === 'pelsung') return 'Pelsung'
  const name = (i.name || '').trim()
  if (name.includes(' - ')) return name.split(' - ')[0].trim()
  return name || i.slug || 'Institution'
}

/**
 * GET /api/register
 * Returns institutions (active only), registration policy, and caller status.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getPlatformSettings()
  const policy = toRegistrationPolicy(settings)

  let institutions: any[] | null = null
  {
    const withDisplay = await supabase
      .from('institutions')
      .select('id, name, slug, display_name, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (!withDisplay.error) {
      institutions = withDisplay.data
    } else {
      const fallback = await supabase
        .from('institutions')
        .select('id, name, slug, display_name')
        .order('name', { ascending: true })
      institutions = fallback.data
    }
  }

  const institutionsForUi = (institutions || [])
    .filter((i: any) => i.is_active !== false)
    .map((i: any) => ({
      id: i.id,
      slug: i.slug,
      name: shortLabel(i),
      display_name: shortLabel(i),
    }))

  const { data: registration } = await supabase
    .from('student_registrations')
    .select('id, registration_status, institution_id, review_notes, rejection_reason, requested_role')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || '' },
    institutions: institutionsForUi,
    registration: registration || null,
    account_status: profile?.account_status || 'pending',
    policy,
    site_name: settings.site_name,
  })
}

/**
 * POST /api/register
 * Submit (or resubmit) registration. Required fields follow platform policy.
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

  const settings = await getPlatformSettings()
  const policy = toRegistrationPolicy(settings)

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
    pelsung_number,
    emergency_contact_name,
    emergency_contact_phone,
    hear_about_us,
    tos_accepted,
  } = body || {}

  const missing: string[] = []
  if (!full_name?.trim()) missing.push('full_name')
  if (!phone_number?.trim()) missing.push('phone_number')
  if (!institution_id?.trim()) missing.push('institution_id')

  if (policy.require_identity_documents) {
    if (!cid_number?.trim()) missing.push('cid_number')
    if (!passport_photo_url?.trim()) missing.push('passport_photo_url')
    if (!cid_photo_url?.trim()) missing.push('cid_photo_url')
    if (!gewog?.trim()) missing.push('gewog')
    if (!dzongkhag?.trim()) missing.push('dzongkhag')
  }
  if (policy.require_qualification && !education_level?.trim()) {
    missing.push('education_level')
  }
  if (policy.require_student_id && !pelsung_number?.trim()) {
    missing.push('pelsung_number')
  }
  if (policy.require_emergency_contact) {
    if (!emergency_contact_name?.trim()) missing.push('emergency_contact_name')
    if (!emergency_contact_phone?.trim()) missing.push('emergency_contact_phone')
  }
  if (policy.require_tos_consent && !tos_accepted) {
    missing.push('tos_accepted')
  }

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

  const cid = cid_number?.trim() || null
  if (cid && !CID_RE.test(cid)) {
    return NextResponse.json(
      { error: 'CID number must be exactly 11 digits.' },
      { status: 400 }
    )
  }

  const { data: institution, error: instError } = await supabase
    .from('institutions')
    .select('id, is_active')
    .eq('id', institution_id)
    .maybeSingle()

  if (instError || !institution || (institution as any).is_active === false) {
    return NextResponse.json({ error: 'Please select a valid institution.' }, { status: 400 })
  }

  const role = REQUESTABLE_ROLES.includes(requested_role) ? requested_role : 'student'
  const teachingRequest = isTeachingRequestRole(role)
  const autoActivate = !policy.require_identity_documents
  const now = new Date().toISOString()

  const payload = {
    user_id: user.id,
    institution_id,
    full_name: full_name.trim(),
    email: user.email,
    phone_number: phone_number.trim(),
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    cid_number: cid,
    passport_photo_url: passport_photo_url?.trim() || null,
    cid_photo_url: cid_photo_url?.trim() || null,
    requested_role: role,
    class: className || null,
    education_level: education_level?.trim() || null,
    village: village || null,
    gewog: gewog?.trim() || null,
    dzongkhag: dzongkhag?.trim() || null,
    parent_guardian_name: parent_guardian_name || null,
    parent_guardian_phone: parent_guardian_phone || null,
    motivation_statement: motivation_statement || null,
    pelsung_number: pelsung_number?.trim() || null,
    emergency_contact_name: emergency_contact_name?.trim() || null,
    emergency_contact_phone: emergency_contact_phone?.trim() || null,
    hear_about_us: hear_about_us?.trim() || null,
    tos_accepted_at: policy.require_tos_consent && tos_accepted ? now : null,
    registration_status: autoActivate && !teachingRequest ? 'approved' : 'submitted',
    submitted_at: now,
    updated_at: now,
    ...(autoActivate && !teachingRequest
      ? { reviewed_at: now, review_notes: 'Auto-approved: identity documents are not required.' }
      : {}),
  }

  const { data: upserted, error: upsertError } = await supabase
    .from('student_registrations')
    .upsert(payload, { onConflict: 'user_id,institution_id' })
    .select('id')
    .maybeSingle()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  await supabase
    .from('profiles')
    .update({
      institution_id,
      full_name: full_name.trim(),
      updated_at: now,
    })
    .eq('id', user.id)

  const admin = await tryCreateServiceClient()

  if (autoActivate && !admin) {
    return NextResponse.json(
      { error: 'Server cannot activate accounts right now. Please try again or contact support.' },
      { status: 500 }
    )
  }

  if (autoActivate && admin) {
    const result = await autoActivateStudentAccount(admin, {
      userId: user.id,
      institutionId: institution_id,
      fullName: full_name.trim(),
      registrationId: upserted?.id,
      approveRegistration: !teachingRequest,
      phoneNumber: phone_number.trim(),
      cidNumber: cid,
      pelsungNumber: pelsung_number?.trim() || null,
      className: className || null,
      dzongkhag: dzongkhag?.trim() || null,
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } else if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('account_status')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.account_status === 'rejected' || profile?.account_status === 'pending' || !profile?.account_status) {
      await admin
        .from('profiles')
        .update({
          account_status: 'pending',
          institution_id,
          full_name: full_name.trim(),
          updated_at: now,
        })
        .eq('id', user.id)
      try {
        const { data } = await admin.auth.admin.getUserById(user.id)
        const current = (data?.user?.app_metadata as Record<string, unknown>) || {}
        await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...current, account_status: 'pending' },
        })
      } catch (metaErr) {
        console.error('[register] failed to sync pending metadata:', metaErr)
      }
    }
  }

  if (!autoActivate || teachingRequest) {
    try {
      const { notifyApproversOfRegistration } = await import('@/lib/notify-approvers')
      await notifyApproversOfRegistration({
        applicantName: full_name.trim(),
        applicantEmail: user.email,
        institutionId: institution_id,
        registrationUserId: user.id,
        requestedRole: role,
      })
    } catch (notifyErr) {
      console.error('[register] notification fan-out failed:', notifyErr)
    }
  }

  if (autoActivate) {
    return NextResponse.json({
      success: true,
      activated: true,
      teachingPending: teachingRequest,
      message: teachingRequest
        ? 'Your learner account is ready. A superadmin still needs to approve your teaching role.'
        : 'Welcome — your account is ready.',
    })
  }

  return NextResponse.json({ success: true, message: 'Registration submitted for review.' })
}
