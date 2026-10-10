-- ============================================================================
-- 031: Short institute display names + assigned-reviewer-only approval notes
-- ============================================================================
-- Approval model (enterprise / online LMS):
--   ONLY superadmin OR an active row in registration_reviewers for that
--   institution may approve. Teachers are NOT auto-approvers just because they
--   teach or have profiles.institution_id set — they must be explicitly
--   assigned via /admin/reviewers.
--
-- is_registration_reviewer() from migration 027 already implements this.
-- This migration only shortens institution names for the registration dropdown
-- and adds an optional display_name column preferred by the API/UI.

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Prefer short, human-readable labels for known institutes
UPDATE institutions
SET
  display_name = COALESCE(display_name, 'Pelsung'),
  name = CASE
    WHEN slug = 'pelsung' THEN 'Pelsung'
    WHEN name ILIKE '%pelsung%guardians%' THEN 'Pelsung'
    ELSE name
  END
WHERE slug = 'pelsung'
   OR name ILIKE '%pelsung%guardians%';

-- Backfill display_name from name where still null
UPDATE institutions
SET display_name = name
WHERE display_name IS NULL OR btrim(display_name) = '';

COMMENT ON COLUMN institutions.display_name IS
  'Short human-readable label for signup dropdowns and UI. Prefer over name.';

COMMENT ON FUNCTION is_registration_reviewer(UUID, UUID) IS
  'True if user is superadmin OR an active registration_reviewers assignee for the institution. Teachers are not auto-granted.';
