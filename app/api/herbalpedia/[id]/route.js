import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb(admin = true) {
  const key = admin ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) : process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

// Resolve current user from Authorization header token
async function getCurrentUser(request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) return { user: null, token: null };
    const token = auth.split(' ')[1];
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return { user: null, token: null };
    return { user: data.user, token };
  } catch {
    return { user: null, token: null };
  }
}

async function isAdminUser(userId) {
  if (!userId) return false;
  const client = sb(true);
  const { data, error } = await client
    .from('users')
    .select('id,role')
    .eq('id', userId)
    .single();
  if (error) return false;
  return (data?.role || '').toLowerCase() === 'admin';
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
    // Authn
    const { user } = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = sb(true);
    // Load current row for ownership and status checks
    const { data: current, error: curErr } = await adminClient
      .from('herbalpedia')
      .select('id, uploaded_by, status')
      .eq('id', id)
      .single();
    if (curErr) throw new Error(curErr.message);
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const amAdmin = await isAdminUser(user.id);
    const isOwner = current.uploaded_by && current.uploaded_by === user.id;
    if (!amAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    // Permission: only admin can directly change status; owners cannot set it
    if (!amAdmin) {
      delete updates.status;
      if ((current.status || '').toLowerCase() === 'approved') {
        updates.status = 'pending';
      }
    }

    const { data, error } = await adminClient
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
    // Authn
    const { user } = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = sb(true);
    // Ownership check
    const { data: current, error: curErr } = await adminClient
      .from('herbalpedia')
      .select('id, uploaded_by')
      .eq('id', id)
      .single();
    if (curErr) throw new Error(curErr.message);
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const amAdmin = await isAdminUser(user.id);
    const isOwner = current.uploaded_by && current.uploaded_by === user.id;
    if (!amAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await adminClient
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
