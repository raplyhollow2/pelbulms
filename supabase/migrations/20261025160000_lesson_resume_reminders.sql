CREATE TABLE IF NOT EXISTS public.lesson_resume_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress_percentage integer NOT NULL,
  remind_at timestamptz NOT NULL,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_resume_reminders_user_lesson_key UNIQUE (user_id, lesson_id),
  CONSTRAINT lesson_resume_reminders_percent_check CHECK (
    progress_percentage >= 0 AND progress_percentage <= 100
  )
);

CREATE INDEX IF NOT EXISTS lesson_resume_reminders_due_idx
  ON public.lesson_resume_reminders (remind_at)
  WHERE emailed_at IS NULL;

ALTER TABLE public.lesson_resume_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.lesson_resume_reminders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.lesson_resume_reminders TO service_role;

INSERT INTO public.email_templates (key, label, description, enabled, subject, html_body, text_body, variables)
VALUES (
  'lesson.incomplete',
  'Unfinished lesson',
  'Sent the day after a learner leaves a video unfinished. Skipped when email notifications are off.',
  true,
  'Finish {{lesson_title}} ({{progress_percentage}}% complete)',
  '<p>Hi {{learner_name}},</p><p>You left <strong>{{lesson_title}}</strong> in {{course_title}} at {{progress_percentage}}% complete.</p><p><a href="{{action_url}}">Continue the lesson</a></p>',
  E'Hi {{learner_name}},\n\nYou left {{lesson_title}} in {{course_title}} at {{progress_percentage}}% complete.\n\nContinue the lesson: {{action_url}}',
  '["learner_name","lesson_title","course_title","progress_percentage","action_url"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
