import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb(admin = true) {
  const key = admin ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) : process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

export async function GET(request, ctx) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await sb(true)
      .from('herbalpedia')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('GET /api/herbalpedia/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memuat herbal.' }, { status: 500 });
  }
}

export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const updates = {};
    if (typeof body.nama_umum === 'string') updates.nama_umum = body.nama_umum.trim();
    if (typeof body.nama_ilmiah === 'string' || body.nama_ilmiah === null) updates.nama_ilmiah = body.nama_ilmiah?.trim?.() ?? null;
    if (typeof body.bagian === 'string' || body.bagian === null) updates.bagian = body.bagian?.trim?.() ?? null;
    if (typeof body.manfaat === 'string' || body.manfaat === null) updates.manfaat = body.manfaat?.trim?.() ?? null;
    if (typeof body.cara_penggunaan === 'string' || body.cara_penggunaan === null) updates.cara_penggunaan = body.cara_penggunaan?.trim?.() ?? null;
    if (typeof body.gambar_url === 'string' || body.gambar_url === null) updates.gambar_url = body.gambar_url?.trim?.() ?? null;
    if (typeof body.status === 'string') updates.status = body.status.trim();

    if (updates.bagian && updates.bagian.length > 500) return NextResponse.json({ error: 'bagian maksimal 500 karakter' }, { status: 400 });
    if (updates.manfaat && updates.manfaat.length > 1000) return NextResponse.json({ error: 'manfaat maksimal 1000 karakter' }, { status: 400 });
    if (updates.cara_penggunaan && updates.cara_penggunaan.length > 2000) return NextResponse.json({ error: 'cara_penggunaan maksimal 2000 karakter' }, { status: 400 });
    if (updates.status && !['pending', 'approved', 'rejected'].includes(updates.status)) return NextResponse.json({ error: 'status tidak valid' }, { status: 400 });

    const { data, error } = await sb(true)
      .from('herbalpedia')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('PATCH /api/herbalpedia/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui herbal.' }, { status: 500 });
  }
}

export async function DELETE(request, ctx) {
  try {
    const { id } = await ctx.params;
    const { error } = await sb(true)
      .from('herbalpedia')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/herbalpedia/[id] error:', err);
    return NextResponse.json({ error: 'Gagal menghapus herbal.' }, { status: 500 });
  }
}
