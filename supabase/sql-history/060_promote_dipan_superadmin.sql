-- ============================================================================
-- Promote dipanpradhan.biz@gmail.com to superadmin
-- ============================================================================
-- The live LMS has no superadmin rows; this account is the platform operator.
-- The auth-metadata sync trigger (055) merges role into auth.users.app_metadata.
-- Sign out and back in (or refresh the session) so the JWT picks up the new role.
-- ============================================================================

UPDATE public.profiles
SET
  role = 'superadmin',
  account_status = 'active',
  updated_at = NOW()
WHERE lower(email) = 'dipanpradhan.biz@gmail.com';
