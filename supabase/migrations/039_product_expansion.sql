-- Phase 1–10 product expansion: resume, module resources, invite codes,
-- co-teachers, interventions, scenarios, richer profiles, paid enrollment.

-- Resume: last lesson on the enrollment
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS last_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_last_accessed
  ON enrollments (user_id, last_accessed_at DESC);

-- Module-level resources (files/links shared across lessons)
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'::jsonb;

-- Enrollment modes: invite_code + paid
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_enrollment_mode_check;
ALTER TABLE courses
  ADD CONSTRAINT courses_enrollment_mode_check
  CHECK (enrollment_mode IN ('auto', 'approval', 'invite_code', 'paid'));

COMMENT ON COLUMN courses.enrollment_mode IS
  'auto | approval | invite_code (unique per-student code) | paid (Stripe)';

-- Per-student enrollment invite codes
CREATE TABLE IF NOT EXISTS enrollment_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  student_email TEXT,
  student_phone TEXT,
  student_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delivery TEXT DEFAULT 'copy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_invites_course
  ON enrollment_invites (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_invites_code
  ON enrollment_invites (code);

ALTER TABLE enrollment_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrollment_invites_select ON enrollment_invites;
CREATE POLICY enrollment_invites_select ON enrollment_invites
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR student_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = enrollment_invites.course_id
        AND (c.instructor_id = auth.uid() OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'resource_person')
        ))
    )
  );

DROP POLICY IF EXISTS enrollment_invites_write ON enrollment_invites;
CREATE POLICY enrollment_invites_write ON enrollment_invites
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = enrollment_invites.course_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = enrollment_invites.course_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
  );

-- Joint facilitators
CREATE TABLE IF NOT EXISTS course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'co_teacher'
    CHECK (role IN ('owner', 'co_teacher', 'assistant')),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_instructors_course
  ON course_instructors (course_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_user
  ON course_instructors (user_id);

ALTER TABLE course_instructors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_instructors_select ON course_instructors;
CREATE POLICY course_instructors_select ON course_instructors
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS course_instructors_write ON course_instructors;
CREATE POLICY course_instructors_write ON course_instructors
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_instructors.course_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_instructors.course_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
          )
        )
    )
  );

-- Seed owners from courses.instructor_id
INSERT INTO course_instructors (course_id, user_id, role)
SELECT id, instructor_id, 'owner'
FROM courses
WHERE instructor_id IS NOT NULL
ON CONFLICT (course_id, user_id) DO NOTHING;

-- Teacher interventions / nudges
CREATE TABLE IF NOT EXISTS teacher_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'nudge', 'question', 'at_risk')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_interventions_course_student
  ON teacher_interventions (course_id, student_id, created_at DESC);

ALTER TABLE teacher_interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_interventions_select ON teacher_interventions;
CREATE POLICY teacher_interventions_select ON teacher_interventions
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = teacher_interventions.course_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM course_instructors ci
      WHERE ci.course_id = teacher_interventions.course_id AND ci.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS teacher_interventions_insert ON teacher_interventions;
CREATE POLICY teacher_interventions_insert ON teacher_interventions
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- Branching scenarios on a lesson
CREATE TABLE IF NOT EXISTS lesson_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_scenarios_lesson
  ON lesson_scenarios (lesson_id);

ALTER TABLE lesson_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_scenarios_select ON lesson_scenarios;
CREATE POLICY lesson_scenarios_select ON lesson_scenarios
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS lesson_scenarios_write ON lesson_scenarios;
CREATE POLICY lesson_scenarios_write ON lesson_scenarios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = lesson_scenarios.lesson_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'resource_person')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = lesson_scenarios.lesson_id
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'resource_person')
          )
        )
    )
  );

-- Public profile extras (headline etc. live in metadata too; columns for query)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN enrollments.last_lesson_id IS
  'Last lesson the student opened; used by Resume / Continue Learning';
COMMENT ON COLUMN modules.resources IS
  'Module-level activity/resource JSON, same shape as lessons.resources';

DO $$
BEGIN
  ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_last_lesson_id_fkey
    FOREIGN KEY (last_lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;
