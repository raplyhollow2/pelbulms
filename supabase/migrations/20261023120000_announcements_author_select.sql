-- Authors can read announcements they wrote, including drafts.
-- Learner visibility stays on the existing published-announcement policies.

DROP POLICY IF EXISTS "announcements_author_select" ON public.announcements;
CREATE POLICY "announcements_author_select"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());
