import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper to create client
function sb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

export async function GET(request, ctx) {
  try {
  const { id } = await ctx.params;
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

export async function PATCH(request, ctx) {
  try {
    const { id } = await ctx.params;
    const payload = await request.json();
    // sanitize fields
    const updates = {};
    if (typeof payload.judul === 'string') updates.judul = payload.judul;
    if (typeof payload.penulis === 'string' || payload.penulis === null) updates.penulis = payload.penulis;
    if (typeof payload.tahun === 'number' || payload.tahun === null) updates.tahun = payload.tahun;
    if (typeof payload.file_url === 'string') updates.file_url = payload.file_url;
  if (typeof payload.is_processed === 'boolean') updates.is_processed = payload.is_processed;

    const client = sb();
    const { data, error } = await client
      .from('jurnal_referensi')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    // If title/author/year changed, propagate to all related vector chunks' metadata
    const metaPatch = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'judul')) {
      metaPatch.title = updates.judul ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'penulis')) {
      metaPatch.author = updates.penulis ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'tahun')) {
      // store as string per process route convention
      metaPatch.year = updates.tahun != null ? String(updates.tahun) : '';
    }

    if (Object.keys(metaPatch).length > 0) {
      // 1) Fetch all matching chunks (ids and metadata)
      const { data: chunks, error: qErr } = await client
        .from('documents')
        .select('id, metadata')
        .contains('metadata', { doc_id: id })
        .limit(10000);
      if (qErr) throw new Error(qErr.message);

      if (Array.isArray(chunks) && chunks.length > 0) {
        // 2) Build new metadata objects, preserving existing fields
        const rows = chunks.map((c) => ({
          id: c.id,
          metadata: { ...(c.metadata || {}), ...metaPatch },
        }));

        // 3) Upsert by primary key id
        const { error: upErr } = await client
          .from('documents')
          .upsert(rows);
        if (upErr) throw new Error(upErr.message);
        console.log(`[Metadata Propagate] Updated metadata for ${rows.length} chunks (doc_id=${id})`);
      }
    }
    return NextResponse.json({ document: data });
  } catch (err) {
    console.error('PATCH /api/documents/[id] error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui dokumen.' }, { status: 500 });
  }
}

export async function DELETE(request, ctx) {
  try {
    const client = sb();
  const { id } = await ctx.params;

    // 1) Get record to read file_url
    const { data: doc, error: getErr } = await client
      .from('jurnal_referensi')
      .select('id,file_url')
      .eq('id', id)
      .single();
    if (getErr) throw new Error(getErr.message);

    // 2) Cascade delete all vector chunks for this document in 'documents' table
    //    First, count how many chunks match, then delete and log the count.
    const { count: vecCount, error: cntErr } = await client
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .contains('metadata', { doc_id: id });
    if (cntErr) {
      console.warn('Gagal menghitung chunks vector:', cntErr.message);
    }

    // We stored metadata like { doc_id: <id>, ... }, so we match via JSON containment
    const { error: vecErr } = await client
      .from('documents')
      .delete()
      .contains('metadata', { doc_id: id });
    if (vecErr) throw new Error(vecErr.message);
    console.log(`[Cascade Delete] Menghapus ${vecCount ?? 0} chunk vektor untuk doc_id=${id}`);

    // 3) Delete the journal reference row
    const { error: delErr } = await client
      .from('jurnal_referensi')
      .delete()
      .eq('id', id);
    if (delErr) throw new Error(delErr.message);

    // 4) Try delete file from storage if we can derive path
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
