-- ============================================================
-- Migration 007: Storage Buckets
-- ============================================================
-- Membuat 3 bucket di Supabase Storage:
--   1. Jurnal  → menyimpan file PDF jurnal ilmiah
--   2. herbal  → menyimpan gambar tanaman herbal
--   3. avatars → menyimpan foto profil pengguna
-- ============================================================

-- Bucket: Jurnal (public, untuk akses PDF tanpa auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Jurnal',
  'Jurnal',
  TRUE,
  52428800,  -- 50 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket: herbal (public, untuk menampilkan gambar herbal)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'herbal',
  'herbal',
  TRUE,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket: avatars (public, untuk menampilkan avatar pengguna)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  3145728,  -- 3 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage Policies
-- ============================================================

-- === Jurnal Bucket ===
-- Public read
CREATE POLICY "jurnal_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'Jurnal');

-- Authenticated users can upload
CREATE POLICY "jurnal_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'Jurnal' AND auth.role() = 'authenticated');

-- Authenticated users can update (upsert)
CREATE POLICY "jurnal_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'Jurnal' AND auth.role() = 'authenticated');

-- Authenticated users can delete
CREATE POLICY "jurnal_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'Jurnal' AND auth.role() = 'authenticated');

-- === Herbal Bucket ===
-- Public read
CREATE POLICY "herbal_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'herbal');

-- Authenticated users can upload
CREATE POLICY "herbal_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'herbal' AND auth.role() = 'authenticated');

-- Authenticated users can update (upsert)
CREATE POLICY "herbal_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'herbal' AND auth.role() = 'authenticated');

-- Authenticated users can delete
CREATE POLICY "herbal_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'herbal' AND auth.role() = 'authenticated');

-- === Avatars Bucket ===
-- Public read
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload to their own folder
CREATE POLICY "avatars_user_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
