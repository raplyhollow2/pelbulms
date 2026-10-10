-- ============================================================================
-- 077: Restore Student learner grants (menu + module view)
-- ============================================================================
-- The Student system role had its catalog grants cleared in the matrix.
-- Re-apply learner defaults only — no teacher or admin menus.

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
