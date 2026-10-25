-- Announcement emails must be the title and content written in the LMS.
UPDATE public.email_templates
SET
  description = 'Email of a course announcement. The subject is the announcement title and the body is the announcement content.',
  subject = '{{title}}',
  html_body = '<p>{{message}}</p><p><a href="{{action_url}}">Open announcement</a></p>',
  text_body = E'{{message}}\n\n{{action_url}}',
  variables = '["title","message","course_title","action_url","learner_name"]'::jsonb,
  updated_at = now()
WHERE key = 'announcement'
  AND (
    coalesce(subject, '') NOT ILIKE '%{{title}}%'
    OR coalesce(text_body, '') NOT ILIKE '%{{message}}%'
    OR coalesce(html_body, '') NOT ILIKE '%{{message}}%'
  );
