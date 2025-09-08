import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

function toSlugName(name) {
  const cleaned = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9\s-_]/g, ' ') // keep alnum, space, -, _
    .replace(/\s+/g, ' ') // collapse spaces
    .trim()
    .toLowerCase()
    .replace(/\s/g, '-');
  return cleaned || 'herbal';
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const nama = String(form.get('nama') || '').trim();
    const file = form.get('file');
    if (!nama || !file || !(file instanceof File)) {
      return NextResponse.json({ error: 'nama dan file gambar wajib diisi' }, { status: 400 });
    }

    const supabase = sb();
    const bucket = 'herbal';
    const base = toSlugName(nama);
    // Default extension .jpg; try to infer mime
    const ext = '.jpg';
    const objectPath = `${base}${ext}`;

    const buf = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'image/jpeg';

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buf, { contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    // Build public URL
  const baseUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(objectPath)}`;
  const cacheBust = `v=${Date.now()}`;
  const publicUrl = `${baseUrl}?${cacheBust}`;
  return NextResponse.json({ url: publicUrl, path: objectPath });
  } catch (err) {
    console.error('Upload herbal image error:', err);
    return NextResponse.json({ error: 'Gagal upload gambar.' }, { status: 500 });
  }
}
