-- Site administration belongs to superadmin, alongside Permissions and AI.
-- Admin keeps institutions and the rest of the admin menu.

UPDATE public.capabilities
SET label = 'Site admin'
WHERE key IN ('admin.settings.view', 'admin.settings.edit');

UPDATE public.capabilities SET sort_order = 210 WHERE key IN ('admin.settings.view', 'admin.settings.edit');
UPDATE public.capabilities SET sort_order = 212 WHERE key LIKE 'admin.settings.site.%';
UPDATE public.capabilities SET sort_order = 214 WHERE key LIKE 'admin.settings.registration.%';
UPDATE public.capabilities SET sort_order = 216 WHERE key LIKE 'admin.settings.marketing.%';
UPDATE public.capabilities SET sort_order = 218 WHERE key LIKE 'admin.settings.emails.%';

DELETE FROM public.role_capabilities rc
USING public.roles r, public.capabilities c
WHERE rc.role_id = r.id
  AND rc.capability_id = c.id
  AND c.key LIKE 'admin.settings.%'
  AND NOT (r.is_system = true AND r.slug = 'superadmin');

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'superadmin'
  AND c.key LIKE 'admin.settings.%'
ON CONFLICT DO NOTHING;
