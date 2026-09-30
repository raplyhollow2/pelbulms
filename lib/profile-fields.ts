import { normalizeDzongkhag } from '@/lib/dzongkhags'

export const PHONE_RE = /^\+975[0-9]{8}$/
export const CID_RE = /^[0-9]{11}$/

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

const GENDERS = new Set<string>(GENDER_OPTIONS.map((option) => option.value))

const PROFILE_TEXT_FIELDS = [
  'gewog',
  'village',
  'education_level',
  'passport_photo_url',
  'cid_photo_url',
  'pelsung_number',
  'class_name',
  'emergency_contact_name',
  'emergency_contact_phone',
  'parent_guardian_name',
  'parent_guardian_phone',
  'headline',
  'website',
] as const

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || null
}

/** Shared validation for admin Edit user and the signed-in account profile. */
export function applyProfileDetails(body: Record<string, unknown>, updates: Record<string, unknown>) {
  const phone = optionalText(body.phone_number)
  if (body.phone_number !== undefined) {
    if (phone === undefined) return 'Invalid phone number'
    if (phone && !PHONE_RE.test(phone)) return 'Phone must be +975 followed by 8 digits.'
    updates.phone_number = phone
  }

  const cid = optionalText(body.cid_number)
  if (body.cid_number !== undefined) {
    if (cid === undefined) return 'Invalid CID number'
    if (cid && !CID_RE.test(cid)) return 'CID number must be exactly 11 digits.'
    updates.cid_number = cid
  }

  if (body.location !== undefined) {
    const place = optionalText(body.location)
    if (place === undefined) return 'Invalid dzongkhag'
    if (place && !normalizeDzongkhag(place)) return 'Please select a valid dzongkhag.'
    updates.location = place ? normalizeDzongkhag(place) : null
  }

  if (body.gender !== undefined) {
    const gender = optionalText(body.gender)
    if (gender === undefined) return 'Invalid gender'
    if (gender && !GENDERS.has(gender)) return 'Invalid gender'
    updates.gender = gender
  }

  if (body.date_of_birth !== undefined) {
    const dob = optionalText(body.date_of_birth)
    if (dob === undefined) return 'Invalid date of birth'
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'Date of birth must be YYYY-MM-DD.'
    updates.date_of_birth = dob
  }

  for (const key of PROFILE_TEXT_FIELDS) {
    if (body[key] === undefined) continue
    const value = optionalText(body[key])
    if (value === undefined) return `Invalid ${key.replaceAll('_', ' ')}`
    updates[key] = value
  }

  return null
}

/** Keep the registration row aligned with the profile fields the directory edits. */
export async function syncRegistrationFromProfile(
  supabase: { from: (table: string) => any },
  userId: string,
  updates: Record<string, unknown>
) {
  const reg: Record<string, unknown> = { updated_at: updates.updated_at }
  const copy = (from: string, to = from, allowNull = true) => {
    if (updates[from] === undefined) return
    if (updates[from] === null && !allowNull) return
    reg[to] = updates[from]
  }
  copy('full_name', 'full_name', false)
  copy('email', 'email', false)
  copy('phone_number', 'phone_number', false)
  copy('date_of_birth')
  copy('gender')
  copy('cid_number')
  copy('gewog')
  copy('village')
  copy('education_level')
  copy('passport_photo_url')
  copy('cid_photo_url')
  copy('pelsung_number')
  copy('emergency_contact_name')
  copy('emergency_contact_phone')
  copy('parent_guardian_name')
  copy('parent_guardian_phone')
  if (updates.location !== undefined) reg.dzongkhag = updates.location
  if (updates.class_name !== undefined) reg.class = updates.class_name
  if (Object.keys(reg).length <= 1) return null
  const { error } = await supabase.from('student_registrations').update(reg).eq('user_id', userId)
  if (error) return error.message || 'Could not sync registration details.'
  return null
}

/** Columns copied from registration onto profiles so the user directory can show them. */
export function registrationProfileColumns(input: {
  phoneNumber?: string | null
  dzongkhag?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  cidNumber?: string | null
  gewog?: string | null
  village?: string | null
  educationLevel?: string | null
  passportPhotoUrl?: string | null
  cidPhotoUrl?: string | null
  pelsungNumber?: string | null
  className?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  parentGuardianName?: string | null
  parentGuardianPhone?: string | null
}): Record<string, unknown> {
  const phone = input.phoneNumber?.trim() || null
  const cid = input.cidNumber?.trim() || null
  return {
    phone_number: phone,
    location: normalizeDzongkhag(input.dzongkhag) || input.dzongkhag?.trim() || null,
    date_of_birth: input.dateOfBirth || null,
    gender: input.gender || null,
    cid_number: cid,
    gewog: input.gewog?.trim() || null,
    village: input.village?.trim() || null,
    education_level: input.educationLevel?.trim() || null,
    passport_photo_url: input.passportPhotoUrl?.trim() || null,
    cid_photo_url: input.cidPhotoUrl?.trim() || null,
    pelsung_number: input.pelsungNumber?.trim() || null,
    class_name: input.className?.trim() || null,
    emergency_contact_name: input.emergencyContactName?.trim() || null,
    emergency_contact_phone: input.emergencyContactPhone?.trim() || null,
    parent_guardian_name: input.parentGuardianName?.trim() || null,
    parent_guardian_phone: input.parentGuardianPhone?.trim() || null,
  }
}
