-- ============================================================
-- Migration 004: Tabel documents (vector store untuk embedding)
-- ============================================================
-- Tabel ini menyimpan chunks teks dari jurnal beserta embedding
-- vektor-nya. Digunakan untuk pencarian semantik (similarity search).
-- Model Xenova/all-MiniLM-L6-v2 menghasilkan vektor 384 dimensi.
-- CATATAN: Menggunakan UUID untuk id (sesuai dengan Supabase lama).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  embedding   vector(384),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk mempercepat pencarian berdasarkan metadata (doc_id)
CREATE INDEX IF NOT EXISTS idx_documents_metadata
  ON public.documents USING GIN (metadata jsonb_path_ops);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa membaca dokumen (untuk pencarian semantik)
CREATE POLICY "documents_select_all"
  ON public.documents FOR SELECT
  USING (true);

-- Insert dan delete hanya oleh authenticated users
CREATE POLICY "documents_insert_auth"
  ON public.documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "documents_update_auth"
  ON public.documents FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "documents_delete_auth"
  ON public.documents FOR DELETE
  USING (auth.role() = 'authenticated');
