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
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
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

/**
 * Handler untuk metode POST pada /api/documents
 * Membuat entri baru pada tabel jurnal_referensi
 */
export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
    );

    const body = await request.json();
    const payload = {
      judul: String(body?.judul || '').trim(),
      penulis: body?.penulis ? String(body.penulis).trim() : null,
      tahun: typeof body?.tahun === 'number' ? body.tahun : (isNaN(parseInt(body?.tahun)) ? null : parseInt(body.tahun)),
      file_url: String(body?.file_url || '').trim()
    };

    if (!payload.judul || !payload.file_url) {
      return NextResponse.json({ error: 'Judul dan file_url wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('jurnal_referensi')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data }, { status: 201 });
  } catch (error) {
    console.error('Gagal membuat dokumen:', error);
    return NextResponse.json({ error: 'Gagal membuat dokumen.' }, { status: 500 });
  }
}