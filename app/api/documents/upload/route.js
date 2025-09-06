import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

function slugifyFileNameFromTitle(title) {
  // Keep spaces but sanitize invalid path chars; then add .pdf
  // For public URL the browser will encode spaces as %20
  const cleaned = String(title)
    .replace(/[\\/:*?"<>|#]/g, ' ') // remove invalid
    .replace(/\s+/g, ' ') // compress whitespace
    .trim();
  return `${cleaned}.pdf`;
}

export async function POST(request) {
  try {
    const supabase = getClient();

    const form = await request.formData();
    const judul = String(form.get('judul') || '').trim();
    const penulis = form.get('penulis') ? String(form.get('penulis')).trim() : null;
    const tahunRaw = form.get('tahun');
    const tahun = tahunRaw != null && String(tahunRaw).length ? parseInt(String(tahunRaw)) : null;
    const file = form.get('file');

    if (!judul || !file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Judul dan file wajib diisi.' }, { status: 400 });
    }

    // Prepare upload target
    const bucket = 'Jurnal';
    const fileName = slugifyFileNameFromTitle(judul);
    const objectPath = fileName; // root in bucket

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: 'application/pdf',
        upsert: true
      });
    if (upErr) throw new Error(`Upload error: ${upErr.message}`);

    // Build public URL similar to examples
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(objectPath)}`;

    // Insert DB row
    const payload = { judul, penulis, tahun: isNaN(tahun) ? null : tahun, file_url: publicUrl };
    const { data, error: insErr } = await supabase
      .from('jurnal_referensi')
      .insert(payload)
      .select('*')
      .single();
    if (insErr) throw new Error(`Insert error: ${insErr.message}`);

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err) {
    console.error('Upload referensi gagal:', err);
    return NextResponse.json({ error: 'Gagal mengunggah referensi.' }, { status: 500 });
  }
}
