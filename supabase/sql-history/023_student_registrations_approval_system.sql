-- ============================================================================
-- PELSUNG STUDENT REGISTRATION & APPROVAL SYSTEM
-- ============================================================================
-- Comprehensive registration and approval workflow for Pelsung "Guardians of Prosperity"
-- Includes detailed student information, photo verification, and teacher approval system

-- ============================================================================
-- ENHANCED INSTITUTIONS TABLE
-- ============================================================================

-- Add approval-related columns to institutions table
ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS signup_approval_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resource_person_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- ENHANCED PROFILES TABLE
-- ============================================================================

-- Add approval status columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20)
  CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected'))
  DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_approval_check TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- STUDENT REGISTRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,

  -- Personal Information
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),

  -- Identification & Pelsung Details
  cid_number VARCHAR(20) NOT NULL,
  pelsung_number VARCHAR(50),
  passport_photo_url TEXT NOT NULL,

  -- Academic Information
  class VARCHAR(50),
  section VARCHAR(50),
  education_level VARCHAR(100),
  institution_name VARCHAR(255),

  -- Location (Bhutan Administrative Divisions)
  village VARCHAR(255),
  gewog VARCHAR(255) NOT NULL,
  dzongkhag VARCHAR(255) NOT NULL,

  -- Family/Guardian Information
  parent_guardian_name VARCHAR(255),
  parent_guardian_phone VARCHAR(20),
  parent_guardian_email VARCHAR(255),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),

  -- Address & Additional Details
  address TEXT,
  special_skills TEXT[],
  interests TEXT[],
  motivation_statement TEXT,

  -- Pelsung Program Specifics
  immersion_cohort VARCHAR(100),
  career_aspirations TEXT,
  previous_experience TEXT,

  -- Registration Status & Metadata
  registration_status VARCHAR(50) CHECK (registration_status IN (
    'draft', 'submitted', 'under_review', 'additional_info_requested',
    'approved', 'rejected', 'waitlisted', 'enrolled'
  )) DEFAULT 'submitted',

  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  rejection_reason TEXT,

  -- Teacher Assignment
  assigned_teacher_id UUID REFERENCES profiles(id),
  teacher_recommendation TEXT,
  teacher_reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  submitted_ip INET,
  submitted_from TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_registration UNIQUE (user_id, institution_id),
  CONSTRAINT unique_cid_per_institution UNIQUE (cid_number, institution_id),
  CONSTRAINT valid_phone_format CHECK (phone_number ~ '^\+975[0-9]{8}$'),
  CONSTRAINT valid_cid_format CHECK (cid_number ~ '^[0-9]{11}$')
);

-- ============================================================================
-- USER APPROVALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id),

  approval_status VARCHAR(20) CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  notes TEXT
);

-- ============================================================================
-- INSTITUTION ACCESS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS institution_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_within_institution VARCHAR(50) CHECK (role_within_institution IN ('student', 'teacher', 'admin', 'resource_person')),
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(institution_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Student registrations indexes
CREATE INDEX IF NOT EXISTS idx_registrations_status ON student_registrations(registration_status, institution_id);
CREATE INDEX IF NOT EXISTS idx_registrations_dzongkhag ON student_registrations(dzongkhag);
CREATE INDEX IF NOT EXISTS idx_registrations_teacher ON student_registrations(assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_registrations_cid ON student_registrations(cid_number);
CREATE INDEX IF NOT EXISTS idx_registrations_review ON student_registrations(reviewed_by, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON student_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON student_registrations(email);

-- User approvals indexes
CREATE INDEX IF NOT EXISTS idx_user_approvals_status ON user_approvals(approval_status, institution_id);
CREATE INDEX IF NOT EXISTS idx_user_approvals_user ON user_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_approvals_reviewed ON user_approvals(reviewed_by, reviewed_at);

-- Institution access indexes
CREATE INDEX IF NOT EXISTS idx_institution_access_user ON institution_access(user_id, institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_access_active ON institution_access(is_active, institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_access_role ON institution_access(role_within_institution);

-- Profiles status index
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(account_status, institution_id);

-- ============================================================================
-- RLS POLICIES FOR STUDENT REGISTRATIONS
-- ============================================================================

-- Enable RLS
ALTER TABLE student_registrations ENABLE ROW LEVEL SECURITY;

-- Students can only view their own registration
CREATE POLICY "Students can view own registration"
ON student_registrations FOR SELECT
USING (auth.uid() = user_id);

-- Teachers and resource persons can view registrations for their institution
CREATE POLICY "Teachers can view institution registrations"
ON student_registrations FOR SELECT
USING (
  institution_id IN (
    SELECT institution_id FROM institution_access
    WHERE user_id = auth.uid()
    AND role_within_institution IN ('teacher', 'resource_person', 'admin')
    AND is_active = true
  )
);

-- Teachers can update registration status (approve/reject)
CREATE POLICY "Teachers can update registrations"
ON student_registrations FOR UPDATE
USING (
  institution_id IN (
    SELECT institution_id FROM institution_access
    WHERE user_id = auth.uid()
    AND role_within_institution IN ('teacher', 'resource_person', 'admin')
    AND is_active = true
  )
)
WITH CHECK (
  institution_id IN (
    SELECT institution_id FROM institution_access
    WHERE user_id = auth.uid()
    AND role_within_institution IN ('teacher', 'resource_person', 'admin')
    AND is_active = true
  )
);

-- Users can insert their own registration
CREATE POLICY "Users can insert own registration"
ON student_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES FOR USER APPROVALS
-- ============================================================================

ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

-- Users can view their own approval status
CREATE POLICY "Users can view own approval"
ON user_approvals FOR SELECT
USING (user_id = auth.uid());

-- Teachers can view approvals for their institution
CREATE POLICY "Teachers can view institution approvals"
ON user_approvals FOR SELECT
USING (
  institution_id IN (
    SELECT institution_id FROM institution_access
    WHERE user_id = auth.uid()
    AND role_within_institution IN ('teacher', 'resource_person', 'admin')
    AND is_active = true
  )
);

-- ============================================================================
-- RLS POLICIES FOR INSTITUTION ACCESS
-- ============================================================================

ALTER TABLE institution_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access
CREATE POLICY "Users can view own access"
ON institution_access FOR SELECT
USING (user_id = auth.uid());

-- Teachers can view access for their institution
CREATE POLICY "Teachers can view institution access"
ON institution_access FOR SELECT
USING (
  institution_id IN (
    SELECT institution_id FROM institution_access
    WHERE user_id = auth.uid()
    AND role_within_institution IN ('teacher', 'resource_person', 'admin')
    AND is_active = true
  )
);

-- ============================================================================
-- RLS POLICIES FOR PROFILES (ENHANCED)
-- ============================================================================

-- Block direct profile updates by users - only through approval process
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile (limited)"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Only allow non-approval-status fields
  account_status = (SELECT account_status FROM profiles WHERE id = auth.uid())
);

-- ============================================================================
-- BHUTANESE DATA VALIDATION FUNCTIONS
-- ============================================================================

-- Function to validate Bhutan CID format
CREATE OR REPLACE FUNCTION validate_bhutan_cid(cid_text VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN cid_text ~ '^[0-9]{11}$';
END;
$$ LANGUAGE plpgsql;

-- Function to validate Bhutan phone format
CREATE OR REPLACE FUNCTION validate_bhutan_phone(phone_text VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN phone_text ~ '^\+975[0-9]{8}$';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to student_registrations
DROP TRIGGER IF EXISTS update_student_registrations_updated_at ON student_registrations;
CREATE TRIGGER update_student_registrations_updated_at
BEFORE UPDATE ON student_registrations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration creates the complete student registration and approval system
-- for Pelsung "Guardians of Prosperity" program.
--
-- Next migrations should include:
-- 1. Auth metadata synchronization triggers
-- 2. Secure approval RPC functions
-- 3. Existing user migration script
-- 4. Pelsung institution setup
-- ============================================================================