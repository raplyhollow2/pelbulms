-- ============================================================================
-- REGISTRATION RLS: allow signup without service_role
-- ============================================================================
-- Local/dev cannot pull Vercel Sensitive SUPABASE_SERVICE_ROLE_KEY.
-- Authenticated applicants need to list institutions and upsert their own row.
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated can view institutions" ON public.institutions;
CREATE POLICY "Authenticated can view institutions"
ON public.institutions FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update own registration" ON public.student_registrations;
CREATE POLICY "Users can update own registration"
ON public.student_registrations FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
