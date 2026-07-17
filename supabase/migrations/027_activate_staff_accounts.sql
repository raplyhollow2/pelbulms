-- ============================================================================
-- ACTIVATE STAFF / ADMIN ACCOUNTS
-- ============================================================================
-- The auth-metadata sync trigger (025) defaults account_status to 'pending'
-- whenever a profile's account_status is NULL. That caused existing staff/admin
-- accounts to be gated by middleware and redirected to /auth/pending-approval.
--
-- This migration explicitly activates the known staff accounts and lets the
-- sync trigger propagate account_status='active' into auth.users app_metadata.
-- Add any additional emails that need immediate access to the list below.
-- ============================================================================

UPDATE profiles
SET
  account_status = 'active',
  updated_at = NOW()
WHERE email IN (
  'dipanpradhan.biz@gmail.com',
  'raplyhollow2@gmail.com'
);

-- Safety net: any account that has enrollments but is still pending/NULL should
-- be considered an existing (legacy) active user.
UPDATE profiles p
SET
  account_status = 'active',
  updated_at = NOW()
WHERE (p.account_status IS NULL OR p.account_status = 'pending')
  AND EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = p.id);

-- Verify
SELECT id, email, role, account_status
FROM profiles
WHERE account_status = 'active'
ORDER BY email;
