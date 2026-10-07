-- Resource persons already open the course studio and own courses.
-- Grant the same teaching-module capabilities instructors use, including
-- quiz configure, so saving a quiz question is not denied.

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'resource_person'
  AND c.cap_group = 'module'
  AND c.key NOT LIKE 'module.platform_ai.%'
  AND c.key NOT LIKE 'module.registration_kyc.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'resource_person'
  AND c.key LIKE 'menu.teach.%'
ON CONFLICT DO NOTHING;
