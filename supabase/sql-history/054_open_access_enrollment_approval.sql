-- ============================================================================
-- Open LMS access + enrollment-only approval
-- ============================================================================
-- New users get instant account access (account_status = active).
-- Course enrollment defaults to creator approval (enrollment_mode = approval).
-- Rejected/suspended accounts remain blocked at the app layer.

-- ---------- profiles: default active ----------
ALTER TABLE profiles
  ALTER COLUMN account_status SET DEFAULT 'active';

-- New signups: explicitly set active so middleware/auth metadata stay in sync
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
    'active'
  );
  RETURN NEW;
END;
$$;

-- Auth metadata sync: prefer active when status is null; merge so provider keys survive
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
      'account_status', COALESCE(NEW.account_status, 'active'),
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

-- Backfill: unlock everyone who was waiting on account KYC (not rejected/suspended)
UPDATE profiles
SET
  account_status = 'active',
  updated_at = NOW()
WHERE account_status IS NULL
   OR account_status = 'pending';

-- Optional KYC must not lock LMS access: approving still links institution,
-- rejecting registration no longer rejects the account.
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

  -- KYC rejection is informational only; do not set account_status = rejected.
  RETURN NEW;
END;
$$;

-- ---------- courses: default enrollment requires creator approval ----------
ALTER TABLE courses
  ALTER COLUMN enrollment_mode SET DEFAULT 'approval';

COMMENT ON COLUMN courses.enrollment_mode IS
  'auto | approval (default) | invite_code | paid — who may join and how';

-- ---------- enrollments: allow pending / rejected statuses ----------
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'enrollments'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_status_check;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_status_check
  CHECK (status IN ('active', 'completed', 'dropped', 'suspended', 'pending', 'rejected'));
