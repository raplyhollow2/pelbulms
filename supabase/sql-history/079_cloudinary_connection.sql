-- Singleton Cloudinary account chosen in Site administration.
-- The API secret must not live on platform_settings: that table is readable by anon.

CREATE TABLE IF NOT EXISTS public.cloudinary_connection (
  id TEXT PRIMARY KEY DEFAULT 'default',
  cloud_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL,
  api_secret_last4 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT cloudinary_connection_singleton CHECK (id = 'default')
);

ALTER TABLE public.cloudinary_connection ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cloudinary_connection FROM anon, authenticated;

COMMENT ON TABLE public.cloudinary_connection IS
  'Singleton Cloudinary account for private media. Readable and writable only by the service role.';
