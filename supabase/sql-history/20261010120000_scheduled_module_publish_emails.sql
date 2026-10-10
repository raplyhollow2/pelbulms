-- Scheduled module release, lesson status mail, and admin email templates.
-- Visibility is a database predicate. Mail is queued per recipient and claimed by the worker.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_timezone TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_publish BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_on_unpublish BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_lessons BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS release_generation INTEGER NOT NULL DEFAULT 0;

-- A module learners can already open stays open. Today the module flag is not
-- what lets them in: any published lesson does. Locked modules whose lessons
-- are all unpublished stay drafts, so this backfill does not unlock them.
-- release_generation = 0 keeps a later re-run from republishing a module a
-- teacher has since taken down. Triggers are created after this, so no mail.
UPDATE public.modules m
SET availability = 'published',
    is_published = true
WHERE m.availability = 'draft'
  AND m.publish_at IS NULL
  AND m.release_generation = 0
  AND (
    m.is_published IS TRUE
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      WHERE l.module_id = m.id
        AND l.is_published IS TRUE
    )
  );

ALTER TABLE public.modules
  DROP CONSTRAINT IF EXISTS modules_availability_check;

ALTER TABLE public.modules
  ADD CONSTRAINT modules_availability_check
  CHECK (availability IN ('draft', 'scheduled', 'published'));

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS notify_on_status BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_generation INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS modules_scheduled_publish_idx
  ON public.modules (publish_at)
  WHERE availability = 'scheduled';

CREATE TABLE IF NOT EXISTS public.email_templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  template_key TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_deliveries_pending_idx
  ON public.email_deliveries (created_at)
  WHERE status = 'pending';

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_deliveries FROM anon, authenticated;

COMMENT ON TABLE public.email_templates IS
  'LMS email copy and on/off gates. Readable only by the service role.';
COMMENT ON TABLE public.email_deliveries IS
  'One outbound email per recipient. Lesson mail is sent when the lesson is published.';

INSERT INTO public.email_templates (key, label, description, enabled, subject, html_body, text_body, variables)
VALUES
  (
    'enrollment.requested',
    'Enrollment requested',
    'Staff email when a learner asks to join a course.',
    true,
    'Enrollment request: {{course_title}}',
    '<p>{{student_name}} requested to join “{{course_title}}”.</p><p><a href="{{action_url}}">Review enrollment request</a></p>',
    E'{{student_name}} requested to join “{{course_title}}”.\n\nReview the request: {{action_url}}',
    '["student_name","course_title","action_url"]'::jsonb
  ),
  (
    'enrollment.approved',
    'Enrollment approved',
    'Learner email when a course creator approves enrollment.',
    true,
    'Enrollment approved: {{course_title}}',
    '<p>You are now enrolled in “{{course_title}}”. Start learning anytime.</p><p><a href="{{action_url}}">Start learning</a></p>',
    E'You are now enrolled in “{{course_title}}”. Start learning anytime.\n\nOpen the course: {{action_url}}',
    '["learner_name","course_title","action_url"]'::jsonb
  ),
  (
    'enrollment.rejected',
    'Enrollment not approved',
    'Learner email when a course creator declines enrollment.',
    true,
    'Enrollment not approved: {{course_title}}',
    '<p>Your request to join “{{course_title}}” was not approved by the course creator.</p><p><a href="{{action_url}}">View course</a></p>',
    E'Your request to join “{{course_title}}” was not approved by the course creator.\n\nView the course: {{action_url}}',
    '["learner_name","course_title","action_url"]'::jsonb
  ),
  (
    'submission.received',
    'Work submitted',
    'Staff email when a learner submits gradable work.',
    true,
    '{{title}}: {{activity_title}}',
    '<p>{{learner_name}} {{verb}} “{{activity_title}}” in “{{course_title}}”.</p><p><a href="{{action_url}}">Grade now</a></p>',
    E'{{learner_name}} {{verb}} “{{activity_title}}” in “{{course_title}}”.\n\nGrade it: {{action_url}}',
    '["learner_name","verb","activity_title","course_title","title","action_url"]'::jsonb
  ),
  (
    'registration.submitted_approver',
    'Registration pending',
    'Approver email when someone submits a registration.',
    true,
    '{{headline}}',
    '<p>{{applicant_name}} ({{applicant_email}}) submitted a {{registration_kind}} registration for {{institution_name}}.</p><p><a href="{{action_url}}">Review registration</a></p>',
    E'{{applicant_name}} ({{applicant_email}}) submitted a {{registration_kind}} registration for {{institution_name}}.\n\nReview it in Rigbu LMS: {{action_url}}',
    '["headline","applicant_name","applicant_email","registration_kind","institution_name","action_url"]'::jsonb
  ),
  (
    'registration.submitted_applicant',
    'Registration submitted',
    'Confirmation to the person who registered.',
    true,
    'Registration submitted',
    '<p>Your {{registration_kind}} registration for {{institution_name}} is pending review.</p><p><a href="{{action_url}}">Check status</a></p>',
    E'Your {{registration_kind}} registration for {{institution_name}} is pending review.\n\nYou can check the status in Rigbu LMS: {{action_url}}',
    '["registration_kind","institution_name","action_url"]'::jsonb
  ),
  (
    'registration.approved',
    'Registration approved',
    'Applicant email when a registration is approved.',
    true,
    'Your Rigbu LMS registration is approved',
    '<p>Hello {{learner_name}},</p><p>Your registration is approved. Sign in to continue.</p><p><a href="{{action_url}}">Sign in</a></p>',
    E'Hello {{learner_name}},\n\nYour registration is approved. Sign in to continue: {{action_url}}',
    '["learner_name","action_url"]'::jsonb
  ),
  (
    'registration.rejected',
    'Registration not approved',
    'Applicant email when a registration is declined. Off until an admin enables it.',
    false,
    'Your Rigbu LMS registration was not approved',
    '<p>Hello {{learner_name}},</p><p>Your registration was not approved.</p><p>{{reason}}</p>',
    E'Hello {{learner_name}},\n\nYour registration was not approved.\n\n{{reason}}',
    '["learner_name","reason","action_url"]'::jsonb
  ),
  (
    'enrollment.invite',
    'Enrollment invite',
    'Email with a unique code a learner uses to join a course.',
    true,
    'Your enrollment code for {{course_title}}',
    '<p>Your unique enrollment code for “{{course_title}}” is <strong>{{code}}</strong>. Enter it on the course page to join.</p>',
    E'Your unique enrollment code for “{{course_title}}” is {{code}}. Enter it on the course page to join.',
    '["course_title","code","learner_name"]'::jsonb
  ),
  (
    'module.published',
    'Module published',
    'Enrolled learners when a module goes live, including a scheduled release.',
    true,
    '{{module_title}} is now available',
    '<p>{{learner_name}}, {{module_title}} in “{{course_title}}” is now open.</p><p><a href="{{action_url}}">Start learning</a></p>',
    E'{{learner_name}}, {{module_title}} in “{{course_title}}” is now open.\n\nStart learning: {{action_url}}',
    '["learner_name","module_title","course_title","action_url"]'::jsonb
  ),
  (
    'module.unpublished',
    'Module unpublished',
    'Enrolled learners when a live module is taken down. Off until an admin enables it.',
    false,
    '{{module_title}} is no longer available',
    '<p>{{learner_name}}, {{module_title}} in “{{course_title}}” is no longer available.</p>',
    E'{{learner_name}}, {{module_title}} in “{{course_title}}” is no longer available.',
    '["learner_name","module_title","course_title","action_url"]'::jsonb
  ),
  (
    'lesson.published',
    'Lesson published',
    'Enrolled learners when a lesson is published and that lesson’s email switch is on.',
    true,
    '{{lesson_title}} is now available',
    '<p>{{learner_name}}, {{lesson_title}} in “{{course_title}}” is now open.</p><p><a href="{{action_url}}">Open the lesson</a></p>',
    E'{{learner_name}}, {{lesson_title}} in “{{course_title}}” is now open.\n\nOpen the lesson: {{action_url}}',
    '["learner_name","lesson_title","course_title","module_title","action_url"]'::jsonb
  ),
  (
    'lesson.unpublished',
    'Lesson unpublished',
    'Enrolled learners when a lesson is unpublished and that lesson’s email switch is on.',
    true,
    '{{lesson_title}} is no longer available',
    '<p>{{learner_name}}, {{lesson_title}} in “{{course_title}}” is no longer available.</p>',
    E'{{learner_name}}, {{lesson_title}} in “{{course_title}}” is no longer available.',
    '["learner_name","lesson_title","course_title","module_title","action_url"]'::jsonb
  ),
  (
    'announcement',
    'Announcement',
    'Optional email for course announcements. In-app notices stay on either way.',
    false,
    '{{title}}',
    '<p>{{message}}</p><p><a href="{{action_url}}">Open announcement</a></p>',
    E'{{message}}\n\n{{action_url}}',
    '["title","message","course_title","action_url","learner_name"]'::jsonb
  ),
  (
    'activity.updated',
    'Activity update',
    'Optional email when a quiz or activity changes. In-app notices stay on either way.',
    false,
    '{{title}}',
    '<p>{{message}}</p><p><a href="{{action_url}}">Open the course</a></p>',
    E'{{message}}\n\n{{action_url}}',
    '["title","message","course_title","action_url","learner_name"]'::jsonb
  ),
  (
    'course.completed',
    'Course completed',
    'Optional email to the instructor when a learner finishes a course.',
    false,
    '{{learner_name}} completed {{course_title}}',
    '<p>{{learner_name}} completed “{{course_title}}”.</p><p><a href="{{action_url}}">View the learner</a></p>',
    E'{{learner_name}} completed “{{course_title}}”.\n\n{{action_url}}',
    '["learner_name","course_title","action_url"]'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.capabilities (key, label, description, cap_group, menu_key, parent_menu_key, action, sort_order)
VALUES
  (
    'admin.settings.email_templates.view',
    'Email templates',
    'View LMS email templates and notification gates.',
    'menu',
    'settings.email_templates',
    'settings',
    'view',
    80
  ),
  (
    'admin.settings.email_templates.edit',
    'Email templates',
    'Edit LMS email templates, gates, and test sends.',
    'menu',
    'settings.email_templates',
    'settings',
    'edit',
    81
  )
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

DELETE FROM public.role_capabilities rc
USING public.roles r, public.capabilities c
WHERE rc.role_id = r.id
  AND rc.capability_id = c.id
  AND c.key IN ('admin.settings.email_templates.view', 'admin.settings.email_templates.edit')
  AND NOT (r.is_system IS TRUE AND r.slug = 'superadmin');

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system IS TRUE
  AND r.slug = 'superadmin'
  AND c.key IN ('admin.settings.email_templates.view', 'admin.settings.email_templates.edit')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.module_is_live(
  p_availability TEXT,
  p_publish_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_availability = 'published'
    OR (
      p_availability = 'scheduled'
      AND p_publish_at IS NOT NULL
      AND p_publish_at <= now()
    );
$$;

CREATE OR REPLACE FUNCTION private.lesson_is_open(p_lesson_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = p_lesson_id
      AND p_user_id IS NOT NULL
      AND c.is_published IS TRUE
      AND public.user_can_see_course(c.id, p_user_id)
      AND private.module_is_live(m.availability, m.publish_at)
      AND (
        l.is_published IS TRUE
        OR (
          m.availability = 'scheduled'
          AND m.publish_at IS NOT NULL
          AND m.publish_at <= now()
          AND m.release_lessons IS TRUE
        )
      )
      AND (
        EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.course_id = c.id
            AND e.user_id = p_user_id
            AND e.status IN ('active', 'completed')
        )
        OR (l.is_free IS TRUE OR l.is_preview IS TRUE)
      )
  );
$$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.module_is_live(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.lesson_is_open(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.module_is_live(TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.lesson_is_open(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lesson_is_open(p_lesson_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.lesson_is_open(p_lesson_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION public.lesson_is_open(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_is_open(UUID, UUID) TO service_role;

DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;
CREATE POLICY "lessons_select_policy" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND (
          private.can_manage_course(m.course_id, auth.uid())
          OR private.lesson_is_open(lessons.id, auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Schedule authority and mail enqueue
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.queue_course_mail(
  p_template_key TEXT,
  p_dedupe_prefix TEXT,
  p_entity_id UUID,
  p_generation INTEGER,
  p_course_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT,
  p_notice_type TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
  FROM public.email_templates
  WHERE key = p_template_key;

  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id AND c.is_published IS TRUE
  ) THEN
    RETURN;
  END IF;

  p_title := left(COALESCE(p_title, 'Course update'), 500);

  INSERT INTO public.notifications (user_id, type, title, message, action_url, is_read, metadata)
  SELECT
    p.id,
    p_notice_type,
    p_title,
    p_message,
    p_action_url,
    false,
    jsonb_build_object(
      'dedupe_key', p_dedupe_prefix || ':' || p_entity_id::text || ':' || p_generation::text || ':' || p.id::text,
      'course_id', p_course_id
    )
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.course_id = p_course_id
    AND e.status IN ('active', 'completed')
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.metadata->>'dedupe_key' =
          p_dedupe_prefix || ':' || p_entity_id::text || ':' || p_generation::text || ':' || p.id::text
    );

  INSERT INTO public.email_deliveries (dedupe_key, template_key, user_id, to_email, status, payload)
  SELECT
    p_dedupe_prefix || ':' || p_entity_id::text || ':' || p_generation::text || ':' || p.id::text,
    p_template_key,
    p.id,
    p.email,
    'pending',
    p_payload || jsonb_build_object(
      'learner_name', COALESCE(NULLIF(btrim(p.full_name), ''), 'there'),
      'action_url', p_action_url
    )
  FROM public.enrollments e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.course_id = p_course_id
    AND e.status IN ('active', 'completed')
    AND p.email IS NOT NULL
    AND btrim(p.email) <> ''
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION private.queue_course_mail(TEXT, TEXT, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.modules_enforce_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.is_published IS DISTINCT FROM OLD.is_published
     AND NEW.availability IS NOT DISTINCT FROM OLD.availability THEN
    IF NEW.is_published IS TRUE THEN
      NEW.availability := 'published';
    ELSE
      NEW.availability := 'draft';
    END IF;
  END IF;

  IF NEW.availability IS NULL THEN
    NEW.availability := CASE WHEN NEW.is_published IS TRUE THEN 'published' ELSE 'draft' END;
  END IF;

  IF NEW.availability = 'published' THEN
    NEW.is_published := true;
    IF TG_OP = 'INSERT' OR OLD.availability IS DISTINCT FROM 'published' THEN
      NEW.release_generation := COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.release_generation ELSE 0 END, 0) + 1;
    END IF;
  ELSIF NEW.availability = 'draft' THEN
    NEW.is_published := false;
    NEW.publish_at := NULL;
    NEW.publish_timezone := NULL;
  ELSIF NEW.availability = 'scheduled' THEN
    NEW.is_published := false;
    IF TG_OP = 'INSERT'
       OR OLD.availability IS DISTINCT FROM 'scheduled'
       OR NEW.publish_at IS DISTINCT FROM OLD.publish_at
       OR NEW.publish_timezone IS DISTINCT FROM OLD.publish_timezone THEN
      IF NEW.publish_at IS NULL OR NEW.publish_timezone IS NULL OR btrim(NEW.publish_timezone) = '' THEN
        RAISE EXCEPTION 'A scheduled module needs a publish time and timezone';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.publish_timezone) THEN
        RAISE EXCEPTION 'Unknown timezone';
      END IF;
      IF NEW.publish_at <= now() + interval '1 minute' THEN
        RAISE EXCEPTION 'Schedule the module more than a minute in the future';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown module availability';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.modules_queue_release_mail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_title TEXT;
  v_was_live BOOLEAN := false;
  v_now_live BOOLEAN;
  v_entered BOOLEAN;
  v_action TEXT;
  v_lesson RECORD;
BEGIN
  v_now_live := private.module_is_live(NEW.availability, NEW.publish_at);
  IF TG_OP = 'UPDATE' THEN
    v_was_live := private.module_is_live(OLD.availability, OLD.publish_at);
  END IF;
  v_entered := NEW.availability = 'published'
    AND (TG_OP = 'INSERT' OR OLD.availability IS DISTINCT FROM 'published');

  IF TG_OP = 'UPDATE' AND NOT v_now_live THEN
    DELETE FROM public.email_deliveries
    WHERE status = 'pending'
      AND template_key = 'module.published'
      AND split_part(dedupe_key, ':', 2) = NEW.id::text;
  END IF;

  IF v_entered AND NEW.release_lessons IS TRUE THEN
    PERFORM set_config('app.module_release', NEW.id::text, true);
    UPDATE public.lessons
    SET is_published = true,
        updated_at = now()
    WHERE module_id = NEW.id
      AND is_published IS DISTINCT FROM true;
  END IF;

  SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;
  v_action := '/learn/' || NEW.course_id::text;

  -- A mail failure must not roll back the publish. Learners who already
  -- finished earlier modules stay on status completed and still get the note.
  BEGIN
    IF v_entered AND NEW.notify_on_publish IS TRUE THEN
      PERFORM private.queue_course_mail(
        'module.published',
        'module_published',
        NEW.id,
        NEW.release_generation,
        NEW.course_id,
        NEW.title || ' is now available',
        COALESCE(v_course_title, 'Your course') || ': ' || NEW.title || ' is now open.',
        v_action,
        'module_published',
        jsonb_build_object(
          'course_title', COALESCE(v_course_title, 'your course'),
          'module_title', NEW.title
        )
      );
    END IF;

    IF TG_OP = 'UPDATE' AND v_was_live AND NOT v_now_live AND NEW.notify_on_unpublish IS TRUE THEN
      PERFORM private.queue_course_mail(
        'module.unpublished',
        'module_unpublished',
        NEW.id,
        NEW.release_generation,
        NEW.course_id,
        NEW.title || ' is no longer available',
        COALESCE(v_course_title, 'Your course') || ': ' || NEW.title || ' is no longer available.',
        v_action,
        'module_unpublished',
        jsonb_build_object(
          'course_title', COALESCE(v_course_title, 'your course'),
          'module_title', NEW.title
        )
      );
    END IF;

    -- Lessons already published are not updated above, so their own trigger
    -- does not run. Send once for each lesson whose email switch is on.
    IF v_entered THEN
      FOR v_lesson IN
        SELECT id, title, status_generation
        FROM public.lessons
        WHERE module_id = NEW.id
          AND is_published IS TRUE
          AND notify_on_status IS TRUE
      LOOP
        BEGIN
          PERFORM private.queue_course_mail(
            'lesson.published',
            'lesson_published',
            v_lesson.id,
            v_lesson.status_generation,
            NEW.course_id,
            v_lesson.title || ' is now available',
            COALESCE(v_course_title, 'Your course') || ': ' || v_lesson.title,
            '/learn/' || NEW.course_id::text || '/lesson/' || v_lesson.id::text,
            'lesson_published',
            jsonb_build_object(
              'course_title', COALESCE(v_course_title, 'your course'),
              'module_title', NEW.title,
              'lesson_title', v_lesson.title
            )
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'lesson publish mail skipped for %: %', v_lesson.id, SQLERRM;
        END;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'module release mail skipped for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.lessons_bump_status_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_published IS DISTINCT FROM OLD.is_published THEN
    NEW.status_generation := COALESCE(OLD.status_generation, 0) + 1;
  END IF;
  NEW.is_published := COALESCE(NEW.is_published, false);
  NEW.notify_on_status := COALESCE(NEW.notify_on_status, false);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.lessons_queue_status_mail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release TEXT;
  v_module_title TEXT;
  v_course_id UUID;
  v_course_title TEXT;
  v_module_live BOOLEAN := false;
  v_template TEXT;
  v_prefix TEXT;
  v_action TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_published IS NOT DISTINCT FROM OLD.is_published THEN
    RETURN NEW;
  END IF;
  IF NEW.notify_on_status IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.is_published IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_release := current_setting('app.module_release', true);
  IF v_release IS NOT NULL AND v_release <> '' THEN
    RETURN NEW;
  END IF;

  SELECT m.title, m.course_id, c.title, private.module_is_live(m.availability, m.publish_at)
  INTO v_module_title, v_course_id, v_course_title, v_module_live
  FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
  WHERE m.id = NEW.module_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A quick unpublish before the send leaves no stale "now available" row.
  DELETE FROM public.email_deliveries
  WHERE status = 'pending'
    AND split_part(dedupe_key, ':', 2) = NEW.id::text
    AND template_key = CASE
      WHEN NEW.is_published IS TRUE THEN 'lesson.unpublished'
      ELSE 'lesson.published'
    END;

  -- Publishing inside a module learners cannot open yet must not mail them.
  -- The module trigger sends once that module actually goes live.
  IF NEW.is_published IS TRUE AND v_module_live IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.is_published IS NOT TRUE AND v_module_live IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.is_published IS TRUE THEN
    v_template := 'lesson.published';
    v_prefix := 'lesson_published';
  ELSE
    v_template := 'lesson.unpublished';
    v_prefix := 'lesson_unpublished';
  END IF;

  v_action := '/learn/' || v_course_id::text || '/lesson/' || NEW.id::text;

  BEGIN
    PERFORM private.queue_course_mail(
      v_template,
      v_prefix,
      NEW.id,
      NEW.status_generation,
      v_course_id,
      CASE WHEN NEW.is_published IS TRUE THEN NEW.title || ' is now available' ELSE NEW.title || ' is no longer available' END,
      COALESCE(v_course_title, 'Your course') || ': ' || NEW.title,
      v_action,
      v_prefix,
      jsonb_build_object(
        'course_title', COALESCE(v_course_title, 'your course'),
        'module_title', COALESCE(v_module_title, ''),
        'lesson_title', NEW.title
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'lesson status mail skipped for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS modules_enforce_availability ON public.modules;
CREATE TRIGGER modules_enforce_availability
  BEFORE INSERT OR UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION private.modules_enforce_availability();

DROP TRIGGER IF EXISTS modules_queue_release_mail ON public.modules;
CREATE TRIGGER modules_queue_release_mail
  AFTER INSERT OR UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION private.modules_queue_release_mail();

DROP TRIGGER IF EXISTS lessons_bump_status_generation ON public.lessons;
CREATE TRIGGER lessons_bump_status_generation
  BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION private.lessons_bump_status_generation();

DROP TRIGGER IF EXISTS lessons_queue_status_mail ON public.lessons;
CREATE TRIGGER lessons_queue_status_mail
  AFTER INSERT OR UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION private.lessons_queue_status_mail();

CREATE OR REPLACE FUNCTION public.claim_email_deliveries(p_limit INTEGER)
RETURNS SETOF public.email_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT d.id
    FROM public.email_deliveries d
    WHERE d.status = 'pending'
      AND d.attempts < 5
      AND (d.claimed_at IS NULL OR d.claimed_at < now() - interval '10 minutes')
    ORDER BY d.created_at
    LIMIT GREATEST(COALESCE(p_limit, 1), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_deliveries d
  SET claimed_at = now(),
      attempts = d.attempts + 1
  FROM picked
  WHERE d.id = picked.id
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_deliveries(INTEGER) TO service_role;
