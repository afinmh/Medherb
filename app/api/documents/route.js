import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

/**
 * Handler untuk metode GET pada /api/documents
 * Fungsi ini akan mengambil data dari tabel jurnal_referensi
 */
export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('jurnal_referensi')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search) {
      query = query.or(`judul.ilike.%${search}%,penulis.ilike.%${search}%`);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: documents, error, count } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      documents: documents || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalDocuments: count,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });

  } catch (error) {
    console.error("Gagal mengambil data dokumen:", error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar dokumen dari database.' },
      { status: 500 }
    );
  }
}