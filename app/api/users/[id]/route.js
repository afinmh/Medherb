import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { data, error } = await sb().from('users').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('GET /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memuat pengguna.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const client = sb();

    const updates = {};
    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.email === 'string') updates.email = body.email;
    if (typeof body.role === 'string') updates.role = body.role;
    if (typeof body.is_verified === 'boolean') updates.is_verified = body.is_verified;

    // Sync changes to auth for email/name
    if (updates.email || updates.name) {
      const attrs = {};
      if (updates.email) attrs.email = updates.email;
      if (updates.name) attrs.user_metadata = { name: updates.name };
      const { error: aerr } = await client.auth.admin.updateUserById(id, attrs);
      if (aerr) console.warn('Auth admin update warning:', aerr.message);
    }

    const { data, error } = await client
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('PATCH /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui pengguna.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = sb();
    const { id } = params;
    // Prefer deleting auth user so it cascades to users table
    const { error: derr } = await client.auth.admin.deleteUser(id);
    if (derr) {
      console.warn('Auth admin delete warning, fallback delete from users table:', derr.message);
      const { error: dbErr } = await client.from('users').delete().eq('id', id);
      if (dbErr) throw new Error(dbErr.message);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/users/[id] error:', err);
    return NextResponse.json({ error: 'Gagal menghapus pengguna.' }, { status: 500 });
  }
}
