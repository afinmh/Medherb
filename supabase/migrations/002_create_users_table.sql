-- ============================================================
-- Migration 002: Tabel users (profil pengguna)
-- ============================================================
-- Tabel ini menyimpan profil pengguna yang terhubung dengan
-- auth.users milik Supabase. Kolom id menggunakan UUID yang
-- sama dengan auth.users.id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
  avatar_url    TEXT,
  password_set  BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index agar pencarian berdasarkan email dan role lebih cepat
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON public.users (role);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Semua orang dapat membaca data user (untuk menampilkan nama, avatar dll)
CREATE POLICY "users_select_all"
  ON public.users FOR SELECT
  USING (true);

-- User hanya dapat mengupdate profil mereka sendiri
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Insert diperbolehkan ketika id sesuai dengan user yang login
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Hanya service_role yang bisa delete (via admin API)
-- Tidak dibuat policy DELETE untuk anon/authenticated
