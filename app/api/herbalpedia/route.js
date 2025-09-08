import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb(admin = true, token) {
  const url = process.env.SUPABASE_URL;
  const key = admin ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) : process.env.SUPABASE_KEY;
  if (token) {
    return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  }
  return createClient(url, key);
}

export async function GET(request) {
  try {
    const client = sb(true);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 6;
    const search = (searchParams.get('search') || '').trim();

    const offset = (page - 1) * limit;
    let query = client
      .from('herbalpedia')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (search) {
      query = query.or(`nama_umum.ilike.%${search}%,nama_ilmiah.ilike.%${search}%`);
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const totalPages = Math.ceil((count || 0) / limit) || 1;
    return NextResponse.json({
      items: data || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (err) {
    console.error('GET /api/herbalpedia error:', err);
    return NextResponse.json({ error: 'Gagal memuat data herbal.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 });
    }
    const body = await request.json();

    const payload = {
      nama_umum: String(body?.nama_umum || '').trim(),
      nama_ilmiah: body?.nama_ilmiah ? String(body.nama_ilmiah).trim() : null,
      bagian: body?.bagian != null ? String(body.bagian).trim() : null,
      manfaat: body?.manfaat != null ? String(body.manfaat).trim() : null,
      cara_penggunaan: body?.cara_penggunaan != null ? String(body.cara_penggunaan).trim() : null,
      gambar_url: body?.gambar_url ? String(body.gambar_url).trim() : null,
      status: body?.status ? String(body.status).trim() : undefined,
    };

    if (!payload.nama_umum) {
      return NextResponse.json({ error: 'nama_umum wajib diisi' }, { status: 400 });
    }
    // Length constraints mirroring DB checks
    if (payload.bagian && payload.bagian.length > 500) {
      return NextResponse.json({ error: 'bagian maksimal 500 karakter' }, { status: 400 });
    }
    if (payload.manfaat && payload.manfaat.length > 1000) {
      return NextResponse.json({ error: 'manfaat maksimal 1000 karakter' }, { status: 400 });
    }
    if (payload.cara_penggunaan && payload.cara_penggunaan.length > 2000) {
      return NextResponse.json({ error: 'cara_penggunaan maksimal 2000 karakter' }, { status: 400 });
    }
    if (payload.status && !['pending', 'approved', 'rejected'].includes(payload.status)) {
      return NextResponse.json({ error: 'status tidak valid' }, { status: 400 });
    }

    // Determine uploader from Authorization token if available
    let uploaded_by = null;
    const auth = request.headers.get('authorization');
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.split(' ')[1];
      // Supabase v2: pass token explicitly to getUser to resolve user identity
      const client = sb(false);
      const { data, error } = await client.auth.getUser(token);
      if (!error && data?.user?.id) {
        uploaded_by = data.user.id;
      }
    }

    const client = sb(true);
    const { data, error } = await client
      .from('herbalpedia')
      .insert({ ...payload, uploaded_by })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/herbalpedia error:', err);
    return NextResponse.json({ error: 'Gagal menambah herbal.' }, { status: 500 });
  }
}
