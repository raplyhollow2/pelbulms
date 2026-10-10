-- ============================================================================
-- 078: Add learner Progress menu capability
-- ============================================================================
-- /learn/progress is a distinct page from /learn/reports. Restore it as its
-- own catalog row so the command palette and sidebar can link to it.

UPDATE public.capabilities SET sort_order = 16 WHERE key = 'menu.learn.settings.view';
UPDATE public.capabilities SET sort_order = 15 WHERE key = 'menu.learn.profile.view';
UPDATE public.capabilities SET sort_order = 14 WHERE key = 'menu.learn.announcements.view';
UPDATE public.capabilities SET sort_order = 13 WHERE key = 'menu.learn.reports.view';

INSERT INTO public.capabilities (key, label, cap_group, menu_key, parent_menu_key, action, sort_order)
VALUES ('menu.learn.progress.view', 'Progress', 'menu', 'learn.progress', NULL, 'view', 12)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

-- Grant Progress to every role that already has any learner menu.
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT DISTINCT rc.role_id, progress.id
FROM public.capabilities progress
JOIN public.capabilities learn
  ON learn.key LIKE 'menu.learn.%'
 AND learn.key <> progress.key
JOIN public.role_capabilities rc
  ON rc.capability_id = learn.id
WHERE progress.key = 'menu.learn.progress.view'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'superadmin'
ON CONFLICT DO NOTHING;
