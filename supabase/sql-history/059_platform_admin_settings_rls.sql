-- ============================================================================
-- 059: Let platform admins write settings/institutions without service_role
-- ============================================================================
-- Local/dev often has no SUPABASE_SERVICE_ROLE_KEY (Vercel Sensitive secrets).
-- Site admin is used by profiles.role = admin (there may be no superadmin rows).

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True when the signed-in user is an LMS admin or superadmin. SECURITY DEFINER avoids RLS recursion on profiles.';

DROP POLICY IF EXISTS "Platform admins can update settings" ON public.platform_settings;
CREATE POLICY "Platform admins can update settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can insert settings" ON public.platform_settings;
CREATE POLICY "Platform admins can insert settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can insert institutions" ON public.institutions;
CREATE POLICY "Platform admins can insert institutions"
  ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can update institutions" ON public.institutions;
CREATE POLICY "Platform admins can update institutions"
  ON public.institutions FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

COMMENT ON TABLE public.platform_settings IS
  'Singleton LMS site administration settings. Readable by everyone; writes by admin/superadmin or service role.';

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.institutions TO authenticated;
