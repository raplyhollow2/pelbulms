-- ============================================================
-- CERTIFICATES STORAGE BUCKET
-- ============================================================
-- Public-read bucket that holds generated certificate PDFs.
-- Uploads are performed by the service-role client (server API),
-- so only read access needs to be public.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read certificate files (verification links / downloads)
DROP POLICY IF EXISTS "certificates_public_read" ON storage.objects;
CREATE POLICY "certificates_public_read" ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates');

SELECT 'Certificates storage bucket ready.' as result;
