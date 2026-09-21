-- ============================================================================
-- 075: Re-seed roles + capabilities catalog (Phase 1 admin matrix)
-- ============================================================================
-- Migration 069 created the tables but the catalog/system-role seeds did not
-- persist. Custom roles may occupy system slugs (e.g. custom Admin → 'admin').
-- This migration is idempotent.

-- ---------------------------------------------------------------------------
-- Free system slugs occupied by custom roles
-- ---------------------------------------------------------------------------

UPDATE public.roles
SET slug = slug || '-custom-' || substr(id::text, 1, 8),
    updated_at = NOW()
WHERE is_system = false
  AND slug IN ('student', 'instructor', 'resource_person', 'admin', 'superadmin');

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
  is_assignable = EXCLUDED.is_assignable,
  all_institutions = EXCLUDED.all_institutions,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

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
-- Seed role_capabilities for system roles
-- ---------------------------------------------------------------------------

-- Superadmin: all capabilities
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'superadmin'
ON CONFLICT DO NOTHING;

-- Admin: platform except AI, permissions, reviewers (today superadmin-only)
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'admin'
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
WHERE r.is_system = true
  AND r.slug = 'resource_person'
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
WHERE r.is_system = true
  AND r.slug = 'instructor'
  AND c.cap_group = 'module'
  AND c.action = 'view'
  AND c.key NOT LIKE 'module.platform_ai.%'
  AND c.key NOT LIKE 'module.registration_kyc.%'
ON CONFLICT DO NOTHING;

-- Student: no admin/module configure grants (empty by design)

-- Custom roles with zero grants: clone from their base archetype
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT custom.id, rc.capability_id
FROM public.roles custom
JOIN public.roles sys
  ON sys.is_system = true
 AND sys.slug = custom.base_archetype
JOIN public.role_capabilities rc
  ON rc.role_id = sys.id
WHERE custom.is_system = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_capabilities existing
    WHERE existing.role_id = custom.id
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill profiles.role_id from profiles.role onto system roles
-- ---------------------------------------------------------------------------

UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE p.role_id IS NULL
  AND r.slug = p.role
  AND r.is_system = true;
