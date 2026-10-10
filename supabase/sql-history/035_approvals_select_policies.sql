-- ============================================================================
-- 035: Let platform admins / superadmins / reviewers read registration queues
-- ============================================================================
-- Fixes production Approvals 500/empty queues caused by RLS that only allowed
-- institution_access teachers to SELECT student_registrations.

DROP POLICY IF EXISTS "Platform admins can view all registrations" ON student_registrations;
CREATE POLICY "Platform admins can view all registrations"
ON student_registrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('superadmin', 'admin')
  )
);

DROP POLICY IF EXISTS "Assigned reviewers can view institute registrations" ON student_registrations;
CREATE POLICY "Assigned reviewers can view institute registrations"
ON student_registrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM registration_reviewers r
    WHERE r.user_id = auth.uid()
      AND r.institution_id = student_registrations.institution_id
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'resource_person'
      AND (
        p.institution_id = student_registrations.institution_id
        OR EXISTS (
          SELECT 1 FROM institutions i
          WHERE i.id = student_registrations.institution_id
            AND i.resource_person_id = auth.uid()
        )
      )
  )
);
