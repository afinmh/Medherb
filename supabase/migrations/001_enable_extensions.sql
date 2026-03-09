-- ============================================================
-- Migration 001: Aktifkan ekstensi yang dibutuhkan
-- ============================================================
-- Ekstensi vector digunakan untuk menyimpan embedding dokumen
-- yang diperlukan oleh fitur pencarian semantik.
-- ============================================================

-- Aktifkan pgvector untuk operasi vector (embedding)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
