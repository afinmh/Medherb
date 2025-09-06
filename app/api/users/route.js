import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/users
 * Mengambil daftar users dari tabel `users` (bukan auth.users) dengan pagination, pencarian, dan filter role.
 * Response menyertakan totalUsers (count exact) seperti pola /api/documents.
 */
export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    if (search) {
      // cari di name atau email
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const totalPages = Math.ceil((count || 0) / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      users: users || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: count ?? 0,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });
  } catch (error) {
    console.error('Gagal mengambil data users:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar users dari database.' },
      { status: 500 }
    );
  }
}
