


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_course"("p_course_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_course_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.role::text IN ('superadmin', 'resource_person')
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND c.instructor_id = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.course_instructors ci
        WHERE ci.course_id = p_course_id
          AND ci.user_id = p_user_id
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = p_user_id
            AND p.role::text = 'admin'
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.institution_access ia
            WHERE ia.user_id = p_user_id
              AND ia.role_within_institution = 'admin'
              AND ia.is_active = true
          )
          OR EXISTS (
            SELECT 1
            FROM public.institution_access ia
            JOIN public.course_institutions x ON x.institution_id = ia.institution_id
            WHERE ia.user_id = p_user_id
              AND ia.role_within_institution = 'admin'
              AND ia.is_active = true
              AND x.course_id = p_course_id
          )
        )
      )
    );
$$;


ALTER FUNCTION "private"."can_manage_course"("p_course_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."enforce_profile_privileges"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.account_status IS NOT DISTINCT FROM OLD.account_status THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'role and account_status can only be changed by an approval or admin path'
    USING ERRCODE = '42501';
END;
$$;


ALTER FUNCTION "private"."enforce_profile_privileges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_teaching_role"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role::text IN ('instructor', 'admin', 'resource_person', 'superadmin')
  );
$$;


ALTER FUNCTION "private"."is_teaching_role"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "private"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."lessons_bump_status_generation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "private"."lessons_bump_status_generation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."lessons_queue_status_mail"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  DELETE FROM public.email_deliveries
  WHERE status = 'pending'
    AND split_part(dedupe_key, ':', 2) = NEW.id::text
    AND template_key = CASE
      WHEN NEW.is_published IS TRUE THEN 'lesson.unpublished'
      ELSE 'lesson.published'
    END;

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


ALTER FUNCTION "private"."lessons_queue_status_mail"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."module_is_live"("p_availability" "text", "p_publish_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT p_availability = 'published'
    OR (
      p_availability = 'scheduled'
      AND p_publish_at IS NOT NULL
      AND p_publish_at <= now()
    );
$$;


ALTER FUNCTION "private"."module_is_live"("p_availability" "text", "p_publish_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."modules_enforce_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "private"."modules_enforce_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."modules_queue_release_mail"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "private"."modules_queue_release_mail"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."queue_course_mail"("p_template_key" "text", "p_dedupe_prefix" "text", "p_entity_id" "uuid", "p_generation" integer, "p_course_id" "uuid", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_notice_type" "text", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "private"."queue_course_mail"("p_template_key" "text", "p_dedupe_prefix" "text", "p_entity_id" "uuid", "p_generation" integer, "p_course_id" "uuid", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_notice_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."recompute_enrollment_progress"("p_user_id" "uuid", "p_course_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_lessons integer;
  done_lessons integer;
  new_pct integer;
BEGIN
  IF p_course_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id;

  SELECT COUNT(*) INTO done_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE lp.user_id = p_user_id
    AND m.course_id = p_course_id
    AND lp.completed = true;

  IF total_lessons = 0 THEN
    new_pct := 0;
  ELSE
    new_pct := ROUND((done_lessons::float / total_lessons::float) * 100);
  END IF;

  UPDATE enrollments
  SET progress_percentage = new_pct,
      completed_at = CASE
        WHEN new_pct >= 100 THEN COALESCE(completed_at, NOW())
        ELSE completed_at
      END,
      status = CASE
        WHEN new_pct >= 100 THEN 'completed'
        WHEN status = 'completed' AND new_pct < 100 THEN 'active'
        ELSE status
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND course_id = p_course_id;
END;
$$;


ALTER FUNCTION "private"."recompute_enrollment_progress"("p_user_id" "uuid", "p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."recompute_enrollments_for_course"("p_course_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec record;
BEGIN
  IF p_course_id IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT user_id
    FROM enrollments
    WHERE course_id = p_course_id
  LOOP
    PERFORM private.recompute_enrollment_progress(rec.user_id, p_course_id);
  END LOOP;
END;
$$;


ALTER FUNCTION "private"."recompute_enrollments_for_course"("p_course_id" "uuid") OWNER TO "postgres";


GRANT USAGE ON SCHEMA "private" TO "authenticated";
GRANT USAGE ON SCHEMA "private" TO "service_role";



REVOKE ALL ON FUNCTION "private"."can_manage_course"("p_course_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_course"("p_course_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."can_manage_course"("p_course_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."enforce_profile_privileges"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."enforce_profile_privileges"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."enforce_profile_privileges"() TO "service_role";



REVOKE ALL ON FUNCTION "private"."is_teaching_role"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_teaching_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."is_teaching_role"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "private"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "private"."module_is_live"("p_availability" "text", "p_publish_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."module_is_live"("p_availability" "text", "p_publish_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "private"."module_is_live"("p_availability" "text", "p_publish_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "private"."queue_course_mail"("p_template_key" "text", "p_dedupe_prefix" "text", "p_entity_id" "uuid", "p_generation" integer, "p_course_id" "uuid", "p_title" "text", "p_message" "text", "p_action_url" "text", "p_notice_type" "text", "p_payload" "jsonb") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."recompute_enrollment_progress"("p_user_id" "uuid", "p_course_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."recompute_enrollments_for_course"("p_course_id" "uuid") FROM PUBLIC;




