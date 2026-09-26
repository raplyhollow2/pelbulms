import { normalizeDzongkhag } from '@/lib/dzongkhags'

export const PHONE_RE = /^\+975[0-9]{8}$/
export const CID_RE = /^[0-9]{11}$/

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

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
