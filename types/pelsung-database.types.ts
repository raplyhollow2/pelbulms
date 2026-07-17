/**
 * Pelsung LMS Database Types
 *
 * These types match the database schema exactly to prevent TypeScript errors
 * All types are based on live Supabase database structure
 */

// ============================================================================
// DATABASE TYPES (matches schema exactly)
// ============================================================================

export interface StudentRegistration {
  id: string
  user_id: string
  institution_id: string

  // Personal Information
  full_name: string
  email: string
  phone_number: string
  date_of_birth: string | null
  gender: 'male' | 'female' | 'other' | null

  // Identification & Pelsung Details
  cid_number: string
  pelsung_number: string | null
  passport_photo_url: string

  // Academic Information
  class: string | null
  section: string | null
  education_level: string | null
  institution_name: string | null

  // Location (Bhutan Administrative Divisions)
  village: string | null
  gewog: string
  dzongkhag: string

  // Family/Guardian Information
  parent_guardian_name: string | null
  parent_guardian_phone: string | null
  parent_guardian_email: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null

  // Address & Additional Details
  address: string | null
  special_skills: string[] | null
  interests: string[] | null
  motivation_statement: string | null

  // Pelsung Program Specifics
  immersion_cohort: string | null
  career_aspirations: string | null
  previous_experience: string | null

  // Registration Status
  registration_status: 'draft' | 'submitted' | 'under_review' | 'additional_info_requested' | 'approved' | 'rejected' | 'waitlisted' | 'enrolled'

  // Review Information
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  rejection_reason: string | null

  // Teacher Assignment
  assigned_teacher_id: string | null
  teacher_recommendation: string | null
  teacher_reviewed_at: string | null

  // Metadata
  submitted_ip: string | null
  submitted_from: string | null
  updated_at: string
}

export interface UserApproval {
  id: string
  user_id: string
  institution_id: string
  requested_by: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  notes: string | null
}

export interface InstitutionAccess {
  id: string
  institution_id: string
  user_id: string
  role_within_institution: 'student' | 'teacher' | 'admin' | 'resource_person'
  granted_by: string | null
  granted_at: string
  expires_at: string | null
  is_active: boolean
}

export interface BhutanDzongkhag {
  id: number
  name: string
  name_dzongkha: string | null
  established_year: number | null
}

// ============================================================================
// ENHANCED PROFILE TYPES
// ============================================================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'instructor' | 'admin' | 'superadmin' | 'resource_person'
  institution_id: string | null
  bio: string | null
  location: string | null
  website: string | null
  metadata: any
  account_status: 'pending' | 'active' | 'suspended' | 'rejected' | null
  enrollment_date: string | null
  last_approval_check: string | null
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  slug: string
  logo_url: string | null
  domain: string | null
  description: string | null
  signup_approval_required: boolean | null
  allowed_email_domains: string[] | null
  max_students: number | null
  resource_person_id: string | null
  settings: any
  created_at: string
  updated_at: string
}

// ============================================================================
// AUTH METADATA TYPES
// ============================================================================

export interface AuthMetadata {
  account_status: 'pending' | 'active' | 'suspended' | 'rejected' | 'deleted'
  role: 'student' | 'instructor' | 'admin' | 'superadmin' | 'resource_person' | 'deleted'
  institution_id: string
  full_name: string
  email: string
  avatar_url: string
  location: string
  last_sync: string
}

export interface SessionUser {
  id: string
  email: string
  email_confirmed_at: string | null
  phone: string | null
  phone_confirmed_at: string | null
  created_at: string
  updated_at: string
  app_metadata: AuthMetadata
  user_metadata: any
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: SessionUser
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApprovalRequest {
  action: 'approve' | 'reject' | 'request_info' | 'bulk_approve' | 'bulk_reject'
  registrationId?: string
  userId?: string
  reviewNotes?: string
  rejectionReason?: string
  registrationIds?: string[]
}

export interface ApprovalResponse {
  success: boolean
  message: string
  action: string
  performedBy: {
    email: string
    name: string
    role: string
  }
  result?: any
}

export interface InstitutionStats {
  pending_registrations: number
  approved_students: number
  rejected_applications: number
  total_active_students: number
  total_active_teachers: number
  total_participants: number
}

export interface RegistrationStatusResponse {
  registered: boolean
  account_status: string | null
  registration_status: string | null
  institution_id: string
  submitted_at: string | null
  reviewed_at: string | null
  review_notes: string | null
  rejection_reason: string | null
  message?: string
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface StudentRegistrationForm {
  // Personal Information
  full_name: string
  email: string
  phone_number: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'

  // Identification
  cid_number: string
  pelsung_number: string

  // Photo Upload
  passport_photo: File | string

  // Academic Information
  class: string
  section: string
  education_level: string
  institution_name: string

  // Location (Bhutan Administrative Divisions)
  village: string
  gewog: string
  dzongkhag: string

  // Family Information
  parent_guardian_name: string
  parent_guardian_phone: string
  parent_guardian_email: string
  emergency_contact_name: string
  emergency_contact_phone: string

  // Additional Details
  address: string
  special_skills: string[]
  interests: string[]
  motivation_statement: string

  // Pelsung Program
  immersion_cohort: string
  career_aspirations: string
  previous_experience: string
}

export interface TeacherAssignmentForm {
  userId: string
  institutionId: string
  role: 'teacher' | 'admin' | 'resource_person'
  assignedCourses: string[]
  permissions: string[]
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface RegistrationReviewCardProps {
  registration: StudentRegistration
  onAction: (registrationId: string, action: 'approve' | 'reject' | 'request_info', notes?: string) => void
  loading?: boolean
  showPhotoModal?: (photoUrl: string, userName: string) => void
}

export interface PhotoModalProps {
  photoUrl: string
  userName: string
  onClose: () => void
}

export interface PendingApprovalPageProps {
  user: SessionUser
}

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface FormValidationResult {
  valid: boolean
  errors: ValidationError[]
  data?: Partial<StudentRegistrationForm>
}

// ============================================================================
// BHUTANESE DATA TYPES
// ============================================================================

export const BHUTANESE_DZONGKHAGS = [
  'Bumthang', 'Chukha', 'Dagana', 'Gasa', 'Haa', 'Lhuentse',
  'Mongar', 'Paro', 'Pema Gatshel', 'Punakha', 'Samdrup Jongkhar',
  'Samtse', 'Sarpang', 'Thimphu', 'Trashigang', 'Trashiyangtse',
  'Trongsa', 'Tsirang', 'Wangdue Phodrang', 'Zhemgang'
] as const

export type BhutaneseDzongkhag = typeof BHUTANESE_DZONGKHAGS[number]

export const GENDER_OPTIONS = ['male', 'female', 'other'] as const
export type GenderOption = typeof GENDER_OPTIONS[number]

export const CLASS_OPTIONS = [
  '7', '8', '9', '10', '11', '12',
  'Year 1', 'Year 2', 'Year 3', 'Year 4',
  'Graduate', 'Diploma', 'Certificate'
] as const

export type ClassOption = typeof CLASS_OPTIONS[number]

// Types are already exported via their interface/type declarations above.