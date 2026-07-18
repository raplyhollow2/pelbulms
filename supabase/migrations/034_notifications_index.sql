-- ============================================================================
-- 034: Ensure notifications can be written by service role + read by owners
-- ============================================================================
-- The notifications table already exists (001). RLS allows users to SELECT/UPDATE
-- their own rows. Inserts are performed with the service role (bypasses RLS).

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

COMMENT ON TABLE notifications IS
  'In-app alerts (e.g. registration_pending for approvers). Inserted by service role APIs.';
