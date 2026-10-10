-- ============================================================================
-- 032: Allow resource_person to approve for their assigned institutes
-- ============================================================================
-- Approvers:
--   1. superadmin (all)
--   2. institutions.resource_person_id = user
--   3. profiles.role = resource_person AND profiles.institution_id = institution
--   4. active registration_reviewers assignment
-- Instructors are NOT auto-granted.

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
  profile_role TEXT;
  profile_institution UUID;
  is_allowed BOOLEAN;
BEGIN
  SELECT role, institution_id
  INTO profile_role, profile_institution
  FROM profiles
  WHERE id = check_user_id;

  IF profile_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- Explicit assignment
  SELECT EXISTS (
    SELECT 1 FROM registration_reviewers r
    WHERE r.user_id = check_user_id
      AND r.institution_id = check_institution_id
      AND r.is_active = true
  ) INTO is_allowed;

  IF COALESCE(is_allowed, false) THEN
    RETURN true;
  END IF;

  -- Designated resource person on the institution
  SELECT EXISTS (
    SELECT 1 FROM institutions i
    WHERE i.id = check_institution_id
      AND i.resource_person_id = check_user_id
  ) INTO is_allowed;

  IF COALESCE(is_allowed, false) THEN
    RETURN true;
  END IF;

  -- Resource person whose home institute matches
  IF profile_role = 'resource_person'
     AND profile_institution IS NOT NULL
     AND profile_institution = check_institution_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION is_registration_reviewer(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_registration_reviewer(UUID, UUID) IS
  'True if superadmin, designated/home resource_person for the institute, or active registration_reviewers assignee.';
