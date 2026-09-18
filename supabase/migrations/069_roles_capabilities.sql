-- ============================================================================
-- 069: Platform roles + capabilities (Phase 1 admin matrix)
-- ============================================================================
-- Adds system/custom roles, a capability catalog, role→capability grants,
-- institution scope per role, and profiles.role_id (keeps profiles.role in sync).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  base_archetype VARCHAR(50) NOT NULL
    CHECK (base_archetype IN ('student', 'instructor', 'admin', 'resource_person', 'superadmin')),
  is_assignable BOOLEAN NOT NULL DEFAULT true,
  all_institutions BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(150) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  cap_group VARCHAR(20) NOT NULL CHECK (cap_group IN ('menu', 'module')),
  menu_key VARCHAR(100) NOT NULL,
  parent_menu_key VARCHAR(100),
  action VARCHAR(20) NOT NULL
    CHECK (action IN ('view', 'add', 'edit', 'delete', 'configure', 'uninstall')),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, capability_id)
);

CREATE TABLE IF NOT EXISTS public.role_institutions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, institution_id)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON public.role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_menu ON public.capabilities(menu_key, action);
CREATE INDEX IF NOT EXISTS idx_roles_base_archetype ON public.roles(base_archetype);

-- ---------------------------------------------------------------------------
-- Seed system roles
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (slug, name, description, is_system, base_archetype, is_assignable, all_institutions, sort_order)
VALUES
  ('student', 'Student', 'Learner with course access', true, 'student', true, true, 10),
  ('instructor', 'Instructor', 'Teacher who creates and manages courses', true, 'instructor', true, true, 20),
  ('resource_person', 'Resource Person', 'Institution KYC / registration reviewer', true, 'resource_person', true, true, 30),
  ('admin', 'Admin', 'Platform administrator', true, 'admin', true, true, 40),
  ('superadmin', 'SuperAdmin', 'Full platform control', true, 'superadmin', true, true, 50)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true,
  base_archetype = EXCLUDED.base_archetype,
  updated_at = NOW();

-- Backfill profiles.role_id from profiles.role
UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE p.role_id IS NULL
  AND r.slug = p.role
  AND r.is_system = true;

-- Keep role_id in sync when role text changes (and vice-versa via app)
CREATE OR REPLACE FUNCTION public.sync_profile_role_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  arche VARCHAR(50);
BEGIN
  -- Explicit role_id wins: sync coarse role from base_archetype (custom + system).
  IF NEW.role_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR NEW.role_id IS DISTINCT FROM OLD.role_id
  ) THEN
    SELECT base_archetype INTO arche FROM public.roles WHERE id = NEW.role_id;
    IF arche IS NOT NULL THEN
      NEW.role := arche;
    END IF;
  -- Role text changed without a matching role_id change: map to system role.
  ELSIF NEW.role IS NOT NULL AND (
    TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role
  ) THEN
    SELECT id INTO NEW.role_id
    FROM public.roles
    WHERE slug = NEW.role AND is_system = true
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_id ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_id
  BEFORE INSERT OR UPDATE OF role, role_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_id();

-- ---------------------------------------------------------------------------
-- Seed capabilities (Phase 1)
-- ---------------------------------------------------------------------------

INSERT INTO public.capabilities (key, label, cap_group, menu_key, parent_menu_key, action, sort_order) VALUES
  -- Menu: Dashboard
  ('admin.dashboard.view', 'Dashboard', 'menu', 'dashboard', NULL, 'view', 10),
  -- Menu: Users
  ('admin.users.view', 'Users', 'menu', 'users', NULL, 'view', 20),
  ('admin.users.add', 'Users', 'menu', 'users', NULL, 'add', 21),
  ('admin.users.edit', 'Users', 'menu', 'users', NULL, 'edit', 22),
  ('admin.users.delete', 'Users', 'menu', 'users', NULL, 'delete', 23),
  -- Menu: Approvals
  ('admin.approvals.view', 'Approvals', 'menu', 'approvals', NULL, 'view', 30),
  ('admin.approvals.edit', 'Approvals', 'menu', 'approvals', NULL, 'edit', 31),
  -- Menu: Reviewers
  ('admin.reviewers.view', 'Reviewers', 'menu', 'reviewers', NULL, 'view', 40),
  ('admin.reviewers.add', 'Reviewers', 'menu', 'reviewers', NULL, 'add', 41),
  ('admin.reviewers.edit', 'Reviewers', 'menu', 'reviewers', NULL, 'edit', 42),
  ('admin.reviewers.delete', 'Reviewers', 'menu', 'reviewers', NULL, 'delete', 43),
  -- Menu: Reports
  ('admin.reports.view', 'Reports', 'menu', 'reports', NULL, 'view', 50),
  -- Menu: Institutions
  ('admin.institutions.view', 'Institutions', 'menu', 'institutions', NULL, 'view', 60),
  ('admin.institutions.add', 'Institutions', 'menu', 'institutions', NULL, 'add', 61),
  ('admin.institutions.edit', 'Institutions', 'menu', 'institutions', NULL, 'edit', 62),
  ('admin.institutions.delete', 'Institutions', 'menu', 'institutions', NULL, 'delete', 63),
  -- Menu: Site settings
  ('admin.settings.view', 'Site settings', 'menu', 'settings', NULL, 'view', 70),
  ('admin.settings.edit', 'Site settings', 'menu', 'settings', NULL, 'edit', 71),
  ('admin.settings.site.view', 'Site', 'menu', 'settings.site', 'settings', 'view', 72),
  ('admin.settings.site.edit', 'Site', 'menu', 'settings.site', 'settings', 'edit', 73),
  ('admin.settings.registration.view', 'Registration', 'menu', 'settings.registration', 'settings', 'view', 74),
  ('admin.settings.registration.edit', 'Registration', 'menu', 'settings.registration', 'settings', 'edit', 75),
  ('admin.settings.marketing.view', 'Marketing', 'menu', 'settings.marketing', 'settings', 'view', 76),
  ('admin.settings.marketing.edit', 'Marketing', 'menu', 'settings.marketing', 'settings', 'edit', 77),
  -- Menu: Permissions (superadmin matrix editor)
  ('admin.permissions.view', 'Permissions', 'menu', 'permissions', NULL, 'view', 80),
  ('admin.permissions.edit', 'Permissions', 'menu', 'permissions', NULL, 'edit', 81),
  -- Menu: AI
  ('admin.ai.view', 'AI', 'menu', 'ai', NULL, 'view', 90),
  ('admin.ai.configure', 'AI', 'menu', 'ai', NULL, 'configure', 91),
  -- Modules
  ('module.certificates.view', 'Certificates', 'module', 'certificates', NULL, 'view', 100),
  ('module.certificates.configure', 'Certificates', 'module', 'certificates', NULL, 'configure', 101),
  ('module.forums.view', 'Forums / Discussion', 'module', 'forums', NULL, 'view', 110),
  ('module.forums.configure', 'Forums / Discussion', 'module', 'forums', NULL, 'configure', 111),
  ('module.quizzes.view', 'Quizzes', 'module', 'quizzes', NULL, 'view', 120),
  ('module.quizzes.configure', 'Quizzes', 'module', 'quizzes', NULL, 'configure', 121),
  ('module.flashcards.view', 'Flashcards', 'module', 'flashcards', NULL, 'view', 130),
  ('module.flashcards.configure', 'Flashcards', 'module', 'flashcards', NULL, 'configure', 131),
  ('module.scorm.view', 'SCORM', 'module', 'scorm', NULL, 'view', 140),
  ('module.scorm.configure', 'SCORM', 'module', 'scorm', NULL, 'configure', 141),
  ('module.interventions.view', 'Interventions', 'module', 'interventions', NULL, 'view', 150),
  ('module.interventions.configure', 'Interventions', 'module', 'interventions', NULL, 'configure', 151),
  ('module.announcements.view', 'Announcements', 'module', 'announcements', NULL, 'view', 160),
  ('module.announcements.configure', 'Announcements', 'module', 'announcements', NULL, 'configure', 161),
  ('module.registration_kyc.view', 'Registration KYC', 'module', 'registration_kyc', NULL, 'view', 170),
  ('module.registration_kyc.configure', 'Registration KYC', 'module', 'registration_kyc', NULL, 'configure', 171),
  ('module.platform_ai.view', 'Platform AI keys', 'module', 'platform_ai', NULL, 'view', 180),
  ('module.platform_ai.configure', 'Platform AI keys', 'module', 'platform_ai', NULL, 'configure', 181)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Seed role_capabilities (preserve current behavior)
-- ---------------------------------------------------------------------------

-- Helper: grant by role slug + capability key pattern
-- Superadmin: all capabilities
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.slug = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin: platform except AI, permissions, reviewers (today superadmin-only)
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.slug = 'admin'
  AND c.key NOT LIKE 'admin.ai.%'
  AND c.key NOT LIKE 'admin.permissions.%'
  AND c.key NOT LIKE 'admin.reviewers.%'
  AND c.key NOT LIKE 'module.platform_ai.%'
ON CONFLICT DO NOTHING;

-- Resource person: approvals + registration KYC view
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.slug = 'resource_person'
  AND c.key IN (
    'admin.approvals.view',
    'admin.approvals.edit',
    'module.registration_kyc.view'
  )
ON CONFLICT DO NOTHING;

-- Instructor: module view (teaching surfaces) — no admin menu
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.slug = 'instructor'
  AND c.cap_group = 'module'
  AND c.action = 'view'
  AND c.key NOT LIKE 'module.platform_ai.%'
  AND c.key NOT LIKE 'module.registration_kyc.%'
ON CONFLICT DO NOTHING;

-- Student: no admin/module configure grants (empty by design)

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read roles" ON public.roles;
CREATE POLICY "Authenticated can read roles"
  ON public.roles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can read capabilities" ON public.capabilities;
CREATE POLICY "Authenticated can read capabilities"
  ON public.capabilities FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can read role_capabilities" ON public.role_capabilities;
CREATE POLICY "Authenticated can read role_capabilities"
  ON public.role_capabilities FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can read role_institutions" ON public.role_institutions;
CREATE POLICY "Authenticated can read role_institutions"
  ON public.role_institutions FOR SELECT TO authenticated
  USING (true);

-- Writes via service role / superadmin APIs only (no broad write policies)

GRANT SELECT ON public.roles, public.capabilities, public.role_capabilities, public.role_institutions
  TO authenticated;

COMMENT ON TABLE public.roles IS
  'System and custom platform roles. Custom roles clone a base_archetype for coarse routing.';
COMMENT ON TABLE public.capabilities IS
  'Phase 1 admin menu/module capability catalog.';
COMMENT ON COLUMN public.profiles.role_id IS
  'FK to roles.id; profiles.role stays synced to base_archetype for legacy RLS/JWT.';
