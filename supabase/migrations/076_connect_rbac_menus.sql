-- ============================================================================
-- 076: Connect RBAC catalog to real menus + teacher module configure
-- ============================================================================
-- Adds learner/teacher sidebar capabilities, relabels admin Overview, and
-- grants system-role defaults so the matrix drives navigation and modules.

UPDATE public.capabilities
SET label = 'Overview',
    sort_order = 120
WHERE key = 'admin.dashboard.view';

INSERT INTO public.capabilities (key, label, cap_group, menu_key, parent_menu_key, action, sort_order) VALUES
  ('menu.learn.dashboard.view', 'Dashboard', 'menu', 'learn.dashboard', NULL, 'view', 10),
  ('menu.learn.courses.view', 'Courses', 'menu', 'learn.courses', NULL, 'view', 11),
  ('menu.learn.reports.view', 'Reports', 'menu', 'learn.reports', NULL, 'view', 12),
  ('menu.learn.announcements.view', 'Announcements', 'menu', 'learn.announcements', NULL, 'view', 13),
  ('menu.learn.profile.view', 'Profile', 'menu', 'learn.profile', NULL, 'view', 14),
  ('menu.learn.settings.view', 'Settings', 'menu', 'learn.settings', NULL, 'view', 15),
  ('menu.teach.dashboard.view', 'Teacher Dashboard', 'menu', 'teach.dashboard', NULL, 'view', 70),
  ('menu.teach.create.view', 'New Course', 'menu', 'teach.create', NULL, 'view', 71),
  ('menu.teach.media.view', 'Media Library', 'menu', 'teach.media', NULL, 'view', 72),
  ('menu.teach.reports.view', 'Reports', 'menu', 'teach.reports', NULL, 'view', 73),
  ('menu.teach.announcements.view', 'Announcements', 'menu', 'teach.announcements', NULL, 'view', 74)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

-- Superadmin: every capability
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true AND r.slug = 'superadmin'
ON CONFLICT DO NOTHING;

-- Student: learner menus + learner module view
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'student'
  AND (
    c.key LIKE 'menu.learn.%'
    OR (
      c.cap_group = 'module'
      AND c.action = 'view'
      AND c.key NOT LIKE 'module.platform_ai.%'
      AND c.key NOT LIKE 'module.registration_kyc.%'
      AND c.key NOT LIKE 'module.interventions.%'
    )
  )
ON CONFLICT DO NOTHING;

-- Instructor: learner + teacher menus + teaching module view/configure
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'instructor'
  AND (
    c.key LIKE 'menu.learn.%'
    OR c.key LIKE 'menu.teach.%'
    OR (
      c.cap_group = 'module'
      AND c.key NOT LIKE 'module.platform_ai.%'
      AND c.key NOT LIKE 'module.registration_kyc.%'
    )
  )
ON CONFLICT DO NOTHING;

-- Admin: instructor set + platform menus except superadmin-only
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

-- Resource person: learner menus + approvals + KYC
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'resource_person'
  AND (
    c.key LIKE 'menu.learn.%'
    OR c.key IN (
      'admin.approvals.view',
      'admin.approvals.edit',
      'module.registration_kyc.view'
    )
  )
ON CONFLICT DO NOTHING;

-- Keep admin menu rows after learner/teacher rows in the matrix
UPDATE public.capabilities SET sort_order = 130 WHERE key LIKE 'admin.users.%';
UPDATE public.capabilities SET sort_order = 140 WHERE key LIKE 'admin.approvals.%';
UPDATE public.capabilities SET sort_order = 150 WHERE key LIKE 'admin.reviewers.%';
UPDATE public.capabilities SET sort_order = 160 WHERE key = 'admin.reports.view';
UPDATE public.capabilities SET sort_order = 170 WHERE key LIKE 'admin.institutions.%';
UPDATE public.capabilities SET sort_order = 180 WHERE key LIKE 'admin.settings.%';
UPDATE public.capabilities SET sort_order = 190 WHERE key LIKE 'admin.permissions.%';
UPDATE public.capabilities SET sort_order = 200 WHERE key LIKE 'admin.ai.%';
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT custom.id, rc.capability_id
FROM public.roles custom
JOIN public.roles sys
  ON sys.is_system = true
 AND sys.slug = custom.base_archetype
JOIN public.role_capabilities rc
  ON rc.role_id = sys.id
WHERE custom.is_system = false
ON CONFLICT DO NOTHING;
