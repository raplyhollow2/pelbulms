INSERT INTO public.email_templates (key, label, description, enabled, subject, html_body, text_body, variables)
VALUES (
  'teacher.intervention',
  'Teacher intervention',
  'Sent when an instructor or staff member messages a learner from interventions or reports. Respects global email_notifications off only (not course-update marketing prefs).',
  true,
  '{{teacher_name}} sent you a message about {{course_title}}',
  '<p>Hi {{learner_name}},</p><p>{{teacher_name}} sent you a message about <strong>{{course_title}}</strong>:</p><blockquote>{{message}}</blockquote><p><a href="{{action_url}}">Open your course</a></p>',
  E'Hi {{learner_name}},\n\n{{teacher_name}} sent you a message about {{course_title}}:\n\n{{message}}\n\nOpen your course: {{action_url}}',
  '["learner_name","teacher_name","course_title","message","action_url"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
