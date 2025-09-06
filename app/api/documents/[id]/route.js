import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper to create client
function sb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { data, error } = await sb()
      .from('jurnal_referensi')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ document: data });
  } catch (err) {
    console.error('GET /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memuat dokumen.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const payload = await request.json();
    // sanitize fields
    const updates = {};
    if (typeof payload.judul === 'string') updates.judul = payload.judul;
    if (typeof payload.penulis === 'string' || payload.penulis === null) updates.penulis = payload.penulis;
    if (typeof payload.tahun === 'number' || payload.tahun === null) updates.tahun = payload.tahun;
    if (typeof payload.file_url === 'string') updates.file_url = payload.file_url;

    const { data, error } = await sb()
      .from('jurnal_referensi')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ document: data });
  } catch (err) {
    console.error('PATCH /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui dokumen.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const client = sb();
    const { id } = params;

    // 1) Get record to read file_url
    const { data: doc, error: getErr } = await client
      .from('jurnal_referensi')
      .select('id,file_url')
      .eq('id', id)
      .single();
    if (getErr) throw new Error(getErr.message);

    // 2) Delete DB row first (or after file delete depending on policy)
    const { error: delErr } = await client
      .from('jurnal_referensi')
      .delete()
      .eq('id', id);
    if (delErr) throw new Error(delErr.message);

    // 3) Try delete file from storage if we can derive path
    // Expecting public file_url like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    if (doc?.file_url) {
      try {
        const url = new URL(doc.file_url);
        const parts = url.pathname.split('/').filter(Boolean);
        // find "object", "public", then bucket and path after that
        const objectIdx = parts.indexOf('object');
        if (objectIdx !== -1 && parts[objectIdx + 1] === 'public' && parts.length >= objectIdx + 4) {
          const bucket = parts[objectIdx + 2];
          const pathParts = parts.slice(objectIdx + 3);
          const objectPath = decodeURIComponent(pathParts.join('/'));
          const { error: stErr } = await client.storage.from(bucket).remove([objectPath]);
          if (stErr) {
            console.warn('Gagal menghapus file storage:', stErr.message);
          }
        }
      } catch (e) {
        console.warn('Tidak dapat mem-parsing file_url untuk hapus storage:', e?.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Gagal menghapus dokumen.' }, { status: 500 });
  }
}
