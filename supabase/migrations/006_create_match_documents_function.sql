-- ============================================================
-- Migration 006: Fungsi RPC match_documents
-- ============================================================
-- Fungsi ini dipanggil oleh API /api/query untuk melakukan
-- pencarian semantik (cosine similarity) terhadap embedding
-- yang tersimpan di tabel documents.
-- CATATAN: Return type id adalah UUID (sesuai tabel documents).
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
