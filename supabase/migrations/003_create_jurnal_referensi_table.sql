-- ============================================================
-- Migration 003: Tabel jurnal_referensi
-- ============================================================
-- Menyimpan metadata jurnal/dokumen ilmiah herbal yang di-upload.
-- Kolom file_url menyimpan URL public ke file PDF di Supabase Storage.
-- CATATAN: Menggunakan UUID untuk id (sesuai dengan Supabase lama).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jurnal_referensi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         TEXT NOT NULL,
  penulis       TEXT,
  tahun         INTEGER,
  file_url      TEXT NOT NULL,
  is_processed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk pencarian dan sorting
CREATE INDEX IF NOT EXISTS idx_jurnal_judul    ON public.jurnal_referensi (judul);
CREATE INDEX IF NOT EXISTS idx_jurnal_created  ON public.jurnal_referensi (created_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.jurnal_referensi ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa membaca daftar jurnal
CREATE POLICY "jurnal_select_all"
  ON public.jurnal_referensi FOR SELECT
  USING (true);

-- Insert, Update, Delete hanya oleh authenticated users
-- (Admin check di level API)
CREATE POLICY "jurnal_insert_auth"
  ON public.jurnal_referensi FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "jurnal_update_auth"
  ON public.jurnal_referensi FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "jurnal_delete_auth"
  ON public.jurnal_referensi FOR DELETE
  USING (auth.role() = 'authenticated');
