-- ============================================================================
-- Mandatory CID KYC + creator enrollment approval
-- ============================================================================
-- New signups start as pending until student KYC is approved.
-- Existing active accounts are NOT mass-locked (054 grandfather).
-- Enrollment still defaults to course-creator approval.
-- KYC rejection of a still-pending account locks LMS access; already-active
-- students keep access if only a teaching application is declined.

-- ---------- profiles: default pending for NEW rows only ----------
ALTER TABLE profiles
  ALTER COLUMN account_status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Keep JWT app_metadata in sync; null status now means pending for new users
CREATE OR REPLACE FUNCTION sync_profile_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_metadata JSONB;
BEGIN
  IF TG_OP = 'INSERT' OR (
    NEW.account_status IS DISTINCT FROM OLD.account_status OR
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.institution_id IS DISTINCT FROM OLD.institution_id OR
    NEW.full_name IS DISTINCT FROM OLD.full_name OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR
    NEW.location IS DISTINCT FROM OLD.location
  ) THEN
    user_metadata := jsonb_build_object(
      'account_status', COALESCE(NEW.account_status, 'pending'),
      'role', COALESCE(NEW.role, 'student'),
      'institution_id', COALESCE(NEW.institution_id::text, ''),
      'full_name', COALESCE(NEW.full_name, ''),
      'email', COALESCE(NEW.email, ''),
      'avatar_url', COALESCE(NEW.avatar_url, ''),
      'location', COALESCE(NEW.location, ''),
      'last_sync', NOW()::text
    );

    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || user_metadata,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', COALESCE(NEW.full_name, ''),
        'avatar_url', COALESCE(NEW.avatar_url, '')
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Approving KYC activates the account. Rejecting only locks still-pending users
-- so a declined teaching application does not strip an approved student.
CREATE OR REPLACE FUNCTION sync_registration_to_profile_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_status = 'approved' AND OLD.registration_status IS DISTINCT FROM 'approved' THEN
    UPDATE profiles
    SET
      account_status = 'active',
      institution_id = COALESCE(NEW.institution_id, institution_id),
      enrollment_date = COALESCE(enrollment_date, NOW())
    WHERE id = NEW.user_id;
  END IF;

  IF NEW.registration_status = 'rejected' AND OLD.registration_status IS DISTINCT FROM 'rejected' THEN
    UPDATE profiles
    SET account_status = 'rejected'
    WHERE id = NEW.user_id
      AND account_status = 'pending';
  END IF;

  -- Resubmit after reject: reopen the account for review
  IF NEW.registration_status = 'submitted'
     AND OLD.registration_status IS DISTINCT FROM 'submitted' THEN
    UPDATE profiles
    SET account_status = 'pending'
    WHERE id = NEW.user_id
      AND account_status = 'rejected';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN profiles.account_status IS
  'pending (awaiting KYC) | active | suspended | rejected — new users default pending; 054-era active users stay active';

ALTER TABLE courses
  ALTER COLUMN enrollment_mode SET DEFAULT 'approval';
