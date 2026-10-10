INSERT INTO public.email_templates (key, label, description, enabled, subject, html_body, text_body, variables)
VALUES (
  'course.published',
  'Course published',
  'Enrolled learners when a teacher publishes the course.',
  true,
  '{{course_title}} is now available',
  '<p>{{learner_name}}, “{{course_title}}” is now open.</p><p><a href="{{action_url}}">Start learning</a></p>',
  E'{{learner_name}}, “{{course_title}}” is now open.\n\nStart learning: {{action_url}}',
  '["learner_name","course_title","action_url"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
