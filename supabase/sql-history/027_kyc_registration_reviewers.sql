-- ============================================================================
-- KYC REGISTRATION FIELDS + SUPERADMIN-ASSIGNED REVIEWERS
-- ============================================================================
-- Phase 1 of the closed-system overhaul:
--   1. Add CID photo + requested-role fields to student_registrations
--   2. Add a registration_reviewers table (superadmin assigns who can approve)
--   3. Rewrite approve_student_registration so ONLY assigned reviewers (or
--      superadmin) can act, and so approval assigns the confirmed role
--   4. Keep superadmin/admin accounts active so the gate never locks them out
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STUDENT REGISTRATION: NEW COLUMNS
-- ----------------------------------------------------------------------------

ALTER TABLE student_registrations
  ADD COLUMN IF NOT EXISTS cid_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS requested_role VARCHAR(50) DEFAULT 'student';

-- ----------------------------------------------------------------------------
-- 1b. PROFILES: make sure resource_person is a legal role (older CHECK omits it)
-- ----------------------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'instructor', 'admin', 'superadmin', 'resource_person'));

-- ----------------------------------------------------------------------------
-- 2. REGISTRATION REVIEWERS TABLE
-- ----------------------------------------------------------------------------
-- A user is allowed to review/approve registrations for an institution only if
-- they have an active row here (or they are a superadmin). Superadmin manages
-- these rows through the admin UI (writes happen with the service client).

CREATE TABLE IF NOT EXISTS registration_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_reviewers_user
  ON registration_reviewers(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_registration_reviewers_institution
  ON registration_reviewers(institution_id, is_active);

ALTER TABLE registration_reviewers ENABLE ROW LEVEL SECURITY;

-- Users can see their own reviewer assignments.
DROP POLICY IF EXISTS "Reviewers can view own assignments" ON registration_reviewers;
CREATE POLICY "Reviewers can view own assignments"
ON registration_reviewers FOR SELECT
USING (user_id = auth.uid());

-- Superadmins can see everything (server writes use the service client which
-- bypasses RLS, so no INSERT/UPDATE policy is required here).
DROP POLICY IF EXISTS "Superadmin can view all reviewers" ON registration_reviewers;
CREATE POLICY "Superadmin can view all reviewers"
ON registration_reviewers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
);

-- ----------------------------------------------------------------------------
-- 3. HELPER: is a given user allowed to review a given institution?
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_registration_reviewer(
  check_user_id UUID,
  check_institution_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super BOOLEAN;
  is_reviewer BOOLEAN;
BEGIN
  SELECT (role = 'superadmin') INTO is_super
  FROM profiles WHERE id = check_user_id;

  IF COALESCE(is_super, false) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM registration_reviewers r
    WHERE r.user_id = check_user_id
      AND r.institution_id = check_institution_id
      AND r.is_active = true
  ) INTO is_reviewer;

  RETURN COALESCE(is_reviewer, false);
END;
$$;

GRANT EXECUTE ON FUNCTION is_registration_reviewer TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. REWRITE approve_student_registration
-- ----------------------------------------------------------------------------
-- Adds:
--   * reviewer-only permission (superadmin OR assigned reviewer)
--   * assigned_role_text so the reviewer confirms/overrides the requested role
--   * institution_access role derived from the confirmed role

-- Drop the older 4-arg version from migration 024 so only one overload remains.
DROP FUNCTION IF EXISTS approve_student_registration(UUID, VARCHAR, TEXT, TEXT);

CREATE OR REPLACE FUNCTION approve_student_registration(
  target_registration_id UUID,
  review_action VARCHAR,
  review_notes_text TEXT DEFAULT NULL,
  rejection_reason_text TEXT DEFAULT NULL,
  assigned_role_text VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_record student_registrations%ROWTYPE;
  final_role VARCHAR;
  institution_role VARCHAR;
BEGIN
  -- Load the registration first so we know which institution to check against.
  SELECT * INTO registration_record
  FROM student_registrations
  WHERE id = target_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  -- Only a superadmin or an assigned reviewer for this institution may act.
  IF NOT is_registration_reviewer(auth.uid(), registration_record.institution_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an assigned reviewer for this institution');
  END IF;

  IF review_action = 'approve' THEN
    IF registration_record.registration_status NOT IN ('submitted', 'under_review', 'additional_info_requested') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Registration not in approvable state');
    END IF;

    -- Confirmed role: reviewer override > requested role > student.
    final_role := COALESCE(
      NULLIF(assigned_role_text, ''),
      NULLIF(registration_record.requested_role, ''),
      'student'
    );

    institution_role := CASE
      WHEN final_role IN ('instructor', 'admin', 'resource_person') THEN 'teacher'
      ELSE 'student'
    END;

    UPDATE student_registrations
    SET registration_status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    UPDATE profiles
    SET account_status = 'active',
        role = final_role,
        institution_id = registration_record.institution_id,
        enrollment_date = NOW(),
        full_name = registration_record.full_name,
        location = registration_record.dzongkhag,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'cid_number', registration_record.cid_number,
          'pelsung_number', registration_record.pelsung_number,
          'class', registration_record.class,
          'phone_number', registration_record.phone_number
        )
    WHERE id = registration_record.user_id;

    INSERT INTO institution_access (
      institution_id, user_id, role_within_institution, granted_by, granted_at
    ) VALUES (
      registration_record.institution_id,
      registration_record.user_id,
      institution_role,
      auth.uid(),
      NOW()
    ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
      role_within_institution = institution_role,
      granted_by = auth.uid(),
      granted_at = NOW(),
      is_active = true;

    INSERT INTO user_approvals (
      user_id, institution_id, approval_status, reviewed_by, reviewed_at, notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'approved',
      auth.uid(),
      NOW(),
      'Approved as ' || final_role || ': ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      notes = 'Approved as ' || final_role || ': ' || COALESCE(review_notes_text, 'No notes');

    -- Sync auth metadata so the middleware gate sees the change instantly.
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'account_status', 'active',
      'role', final_role,
      'institution_id', registration_record.institution_id::text
    )
    WHERE id = registration_record.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Registration approved as ' || final_role,
      'user_id', registration_record.user_id,
      'assigned_role', final_role,
      'registration_id', target_registration_id
    );

  ELSIF review_action = 'reject' THEN
    UPDATE student_registrations
    SET registration_status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        rejection_reason = rejection_reason_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    UPDATE profiles SET account_status = 'rejected'
    WHERE id = registration_record.user_id;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'account_status', 'rejected'
    )
    WHERE id = registration_record.user_id;

    INSERT INTO user_approvals (
      user_id, institution_id, approval_status, reviewed_by, reviewed_at, rejection_reason, notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'rejected',
      auth.uid(),
      NOW(),
      rejection_reason_text,
      'Rejected: ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      notes = 'Rejected: ' || COALESCE(review_notes_text, 'No notes');

    RETURN jsonb_build_object('success', true, 'message', 'Registration rejected', 'registration_id', target_registration_id);

  ELSIF review_action = 'request_info' THEN
    UPDATE student_registrations
    SET registration_status = 'additional_info_requested',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    RETURN jsonb_build_object('success', true, 'message', 'Additional information requested', 'registration_id', target_registration_id);

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_student_registration(UUID, VARCHAR, TEXT, TEXT, VARCHAR) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. SAFETY: never lock elevated accounts out of the gate
-- ----------------------------------------------------------------------------

UPDATE profiles
SET account_status = 'active'
WHERE role IN ('superadmin', 'admin', 'resource_person')
  AND (account_status IS DISTINCT FROM 'active');

-- ============================================================================
-- DONE
-- ============================================================================
