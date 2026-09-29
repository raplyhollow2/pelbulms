-- Delete course: superadmin checkbox, plus the course creator at runtime.
-- Delete users: superadmin only. Remove the grant from every other role.

INSERT INTO public.capabilities (key, label, description, cap_group, menu_key, parent_menu_key, action, sort_order)
VALUES (
  'admin.courses.delete',
  'Courses',
  'Delete a course. The course creator can always delete their own course. A superadmin can delete any course.',
  'menu',
  'courses',
  NULL,
  'delete',
  135
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'superadmin'
  AND c.key = 'admin.courses.delete'
ON CONFLICT DO NOTHING;

DELETE FROM public.role_capabilities rc
USING public.roles r, public.capabilities c
WHERE rc.role_id = r.id
  AND rc.capability_id = c.id
  AND c.key IN ('admin.users.delete', 'admin.courses.delete')
  AND NOT (r.is_system = true AND r.slug = 'superadmin');
