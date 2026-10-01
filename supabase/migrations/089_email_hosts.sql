-- Email hosts configured in Site administration.
-- Secrets must not live on platform_settings: that table is readable by anon.

CREATE TABLE IF NOT EXISTS public.email_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'gmail_smtp', 'smtp')),
  from_name TEXT,
  from_email TEXT NOT NULL,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  smtp_username TEXT,
  secret TEXT NOT NULL,
  secret_last4 TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS email_hosts_one_default
  ON public.email_hosts (is_default)
  WHERE is_default;

ALTER TABLE public.email_hosts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_hosts FROM anon, authenticated;

COMMENT ON TABLE public.email_hosts IS
  'Outbound email hosts (Resend, Gmail SMTP, custom SMTP). Readable and writable only by the service role.';

INSERT INTO public.capabilities (key, label, description, cap_group, menu_key, parent_menu_key, action, sort_order)
VALUES
  (
    'admin.settings.emails.view',
    'Emails',
    'View configured outbound email hosts in Site administration.',
    'menu',
    'settings.emails',
    'settings',
    'view',
    78
  ),
  (
    'admin.settings.emails.edit',
    'Emails',
    'Add, test, and remove outbound email hosts.',
    'menu',
    'settings.emails',
    'settings',
    'edit',
    79
  )
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  cap_group = EXCLUDED.cap_group,
  menu_key = EXCLUDED.menu_key,
  parent_menu_key = EXCLUDED.parent_menu_key,
  action = EXCLUDED.action,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT r.id, c.id
FROM public.roles r
CROSS JOIN public.capabilities c
WHERE r.is_system = true
  AND r.slug = 'superadmin'
  AND c.key IN ('admin.settings.emails.view', 'admin.settings.emails.edit')
ON CONFLICT DO NOTHING;
