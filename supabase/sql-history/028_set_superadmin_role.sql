-- ============================================================================
-- PROMOTE TOP-LEVEL ACCOUNT TO SUPERADMIN
-- ============================================================================
-- The schema (001) already allows role='superadmin' and its RLS policies treat
-- superadmin as the highest tier. Migration 019 created raplyhollow2@gmail.com
-- as the "Super Admin" but only assigned the 'admin' role. This promotes that
-- account to the actual 'superadmin' role (top-level access to everything).
--
-- The auth-metadata sync trigger (025) propagates this into
-- auth.users.app_metadata so middleware sees it instantly.
--
-- Add any other emails that should have top-level access to the IN (...) list.
-- ============================================================================

UPDATE profiles
SET
  role = 'superadmin',
  account_status = 'active',
  updated_at = NOW()
WHERE email IN (
  'raplyhollow2@gmail.com'
);

-- Verify
SELECT id, email, full_name, role, account_status
FROM profiles
WHERE role = 'superadmin';
