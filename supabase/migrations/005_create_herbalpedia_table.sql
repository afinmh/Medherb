-- ============================================================
-- Migration 005: Tabel herbalpedia
-- ============================================================
-- Ensiklopedia tanaman herbal yang dapat diisi oleh user.
-- Status 'pending' → perlu approval admin sebelum ditampilkan.
-- CATATAN: Menggunakan UUID untuk id (sesuai dengan Supabase lama).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.herbalpedia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_umum       TEXT NOT NULL,
  nama_ilmiah     TEXT,
  bagian          TEXT CHECK (char_length(bagian) <= 500),
  manfaat         TEXT CHECK (char_length(manfaat) <= 1000),
  cara_penggunaan TEXT CHECK (char_length(cara_penggunaan) <= 2000),
  gambar_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_herbalpedia_status    ON public.herbalpedia (status);
CREATE INDEX IF NOT EXISTS idx_herbalpedia_uploaded   ON public.herbalpedia (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_herbalpedia_created    ON public.herbalpedia (created_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.herbalpedia ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa membaca data herbal
CREATE POLICY "herbalpedia_select_all"
  ON public.herbalpedia FOR SELECT
  USING (true);

-- Authenticated users bisa menambah herbal baru
CREATE POLICY "herbalpedia_insert_auth"
  ON public.herbalpedia FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Update: pemilik atau melalui service_role (admin via API)
CREATE POLICY "herbalpedia_update_own_or_service"
  ON public.herbalpedia FOR UPDATE
  USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');

-- Delete: pemilik atau melalui service_role (admin via API)
CREATE POLICY "herbalpedia_delete_own_or_service"
  ON public.herbalpedia FOR DELETE
  USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');
