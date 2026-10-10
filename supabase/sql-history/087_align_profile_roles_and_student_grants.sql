-- Point each profile at the system role that matches profiles.role when the
-- current role_id is missing or is a different system role. Custom roles
-- (non-system) are left in place.
UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE r.is_system = true
  AND r.slug = p.role
  AND (
    p.role_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.roles cur WHERE cur.id = p.role_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.roles cur
      WHERE cur.id = p.role_id
        AND cur.is_system = true
        AND cur.slug IS DISTINCT FROM p.role
    )
  );

-- Learner menus were cleared on the Student system role. Restore them only
-- when that role has no grants at all, so a partial uncheck is kept.
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_capabilities rc WHERE rc.role_id = r.id
  )
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
