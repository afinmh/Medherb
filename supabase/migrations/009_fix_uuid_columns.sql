-- ============================================================
-- MIGRATION FIX: Ubah id dari BIGSERIAL ke UUID
-- ============================================================
-- Jalankan ini di Supabase BARU sebelum menjalankan ulang
-- script migrasi Python.
--
-- ALASAN: Supabase lama menggunakan UUID untuk id pada tabel
-- jurnal_referensi, documents, dan herbalpedia.
-- ============================================================

-- 1) Drop tabel yang perlu difix (urutan penting karena dependencies)
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.herbalpedia CASCADE;
DROP TABLE IF EXISTS public.jurnal_referensi CASCADE;

-- Drop fungsi yang mereferensi tipe lama
DROP FUNCTION IF EXISTS public.match_documents;

-- ============================================================
-- 2) Buat ulang tabel jurnal_referensi dengan UUID
-- ============================================================
CREATE TABLE public.jurnal_referensi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         TEXT NOT NULL,
  penulis       TEXT,
  tahun         INTEGER,
  file_url      TEXT NOT NULL,
  is_processed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jurnal_judul   ON public.jurnal_referensi (judul);
CREATE INDEX IF NOT EXISTS idx_jurnal_created ON public.jurnal_referensi (created_at DESC);

ALTER TABLE public.jurnal_referensi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jurnal_select_all"  ON public.jurnal_referensi FOR SELECT USING (true);
CREATE POLICY "jurnal_insert_auth" ON public.jurnal_referensi FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "jurnal_update_auth" ON public.jurnal_referensi FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "jurnal_delete_auth" ON public.jurnal_referensi FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 3) Buat ulang tabel documents dengan UUID
-- ============================================================
CREATE TABLE public.documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  embedding   vector(384),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_metadata
  ON public.documents USING GIN (metadata jsonb_path_ops);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_all"   ON public.documents FOR SELECT USING (true);
CREATE POLICY "documents_insert_auth"  ON public.documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "documents_update_auth"  ON public.documents FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "documents_delete_auth"  ON public.documents FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 4) Buat ulang tabel herbalpedia dengan UUID
-- ============================================================
CREATE TABLE public.herbalpedia (
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

CREATE INDEX IF NOT EXISTS idx_herbalpedia_status   ON public.herbalpedia (status);
CREATE INDEX IF NOT EXISTS idx_herbalpedia_uploaded  ON public.herbalpedia (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_herbalpedia_created   ON public.herbalpedia (created_at DESC);

ALTER TABLE public.herbalpedia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "herbalpedia_select_all"               ON public.herbalpedia FOR SELECT USING (true);
CREATE POLICY "herbalpedia_insert_auth"              ON public.herbalpedia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "herbalpedia_update_own_or_service"    ON public.herbalpedia FOR UPDATE USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');
CREATE POLICY "herbalpedia_delete_own_or_service"    ON public.herbalpedia FOR DELETE USING (auth.uid() = uploaded_by OR auth.role() = 'authenticated');

-- ============================================================
-- 5) Buat ulang fungsi match_documents (id sekarang UUID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding  vector(384),
  match_count      INT DEFAULT 5,
  match_threshold  FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.documents d
  WHERE 1 - (d.embedding <=> query_embedding) >= match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
