import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
// Ensure worker module is bundled to satisfy fake worker import in Node
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Create Supabase client (service role preferred for server routes)
function sb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return createClient(process.env.SUPABASE_URL, key);
}

// Basic text cleanup similar to a typical PDF clean step
function cleanText(raw) {
  if (!raw) return '';
  let text = raw;
  // Normalize newlines
  text = text.replace(/\r\n?|\u2028|\u2029/g, '\n');
  // Remove soft hyphen and zero-width chars
  text = text.replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '');
  // Replace common ligatures and weird quotes/dashes
  const map = {
    '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
    '\u2013': '-', '\u2014': '-', '\u00A0': ' ',
    '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl',
  };
  text = text.replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u00A0\uFB00-\uFB04]/g, m => map[m] || m);
  // Join hyphenated line breaks: word-\nnext -> wordnext
  text = text.replace(/-\s*\n\s*/g, '');
  // Collapse multiple spaces and normalize spacing around punctuation
  text = text.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/([({\[] )/g, '$1');
  // Restore paragraph breaks (best-effort): double newlines -> single marker, then rebuild
  text = text.replace(/\n{2,}/g, '\n\n').replace(/\s*\n\s*/g, '\n');
  // Trim
  return text.trim();
}

async function extractPdfText(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
    let chunks = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruct text with basic line breaks using hasEOL where available
    let pageText = '';
    for (const item of content.items) {
      const str = item.str || '';
      pageText += str;
      if (item.hasEOL) pageText += '\n'; else pageText += ' ';
    }
    chunks.push(pageText.trim());
  }
  return { text: chunks.join('\n\n'), chunks };
}

// ===== bersih_dokumen.py equivalent: isolate main content, aggressive clean, and chunk =====
const CHUNK_SIZE = 750;
const CHUNK_OVERLAP = 50;
const START_KEYWORDS = [
  'introduction', 'pendahuluan', 'latar belakang', 'background'
];
const END_KEYWORDS = [
  'conclusion', 'kesimpulan', 'acknowledg[e]?ment', 'ucapan terima kasih',
  'references', 'daftar pustaka', 'bibliography', 'author contributions',
  'conflict of interest', 'appendix', 'lampiran'
];

function findMainContentSpan(fullText) {
  if (!fullText) return null;
  // Start at beginning of a line, optional number and dot, then keyword (case-insensitive, multiline)
  const startPattern = new RegExp(`^\\s*\\d?\\.?\\s*(?:${START_KEYWORDS.join('|')})`, 'mi');
  const startMatch = startPattern.exec(fullText);
  let startIndex = startMatch ? startMatch.index : -1;
  // Fallback after abstract/abstrak
  if (startIndex === -1) {
    const absMatch = /(\babstract\b|\babstrak\b)/i.exec(fullText);
    if (absMatch) startIndex = absMatch.index + absMatch[0].length;
  }
  let endIndex = fullText.length;
  if (startIndex !== -1) {
    const endPattern = new RegExp(`^\\s*(?:${END_KEYWORDS.join('|')})`, 'mi');
    const after = fullText.slice(startIndex);
    const endMatch = endPattern.exec(after);
    if (endMatch) endIndex = startIndex + endMatch.index;
  }
  return startIndex !== -1 ? fullText.slice(startIndex, endIndex) : null;
}

function cleanTextBlock(text) {
  if (!text) return '';
  // Join hyphenated across line breaks
  let t = text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');
  // Remove URLs/emails
  t = t.replace(/https?:\/\/\S+|www\.[^\s]+|\S+@\S+/g, '');
  const lines = t.split('\n');
  const cleanedLines = lines.map(s => s.trim()).filter(s => s.length > 20);
  t = cleanedLines.join(' ');
  return t.replace(/\s+/g, ' ').trim();
}

function makeChunks(cleaned) {
  const out = [];
  if (!cleaned) return out;
  let start = 0;
  while (start < cleaned.length) {
    const end = start + CHUNK_SIZE;
    out.push(cleaned.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return out;
}

// Embedder singleton state (similar to /api/query)
const embedderState = { instance: null, loading: false };
async function getEmbedder() {
  if (embedderState.instance || embedderState.loading) {
    while (embedderState.loading && !embedderState.instance) {
      await new Promise(r => setTimeout(r, 100));
    }
    return embedderState.instance;
  }
  embedderState.loading = true;
  console.log('🔄 Loading embedder (Xenova/all-MiniLM-L6-v2)...');
  try {
    embedderState.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ Embedder loaded!');
  } catch (e) {
    console.error('❌ Failed loading embedder, trying fallback...', e);
    embedderState.instance = await pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');
    console.log('✅ Fallback embedder loaded!');
  } finally {
    embedderState.loading = false;
  }
  return embedderState.instance;
}

function toVector(output) {
  // Normalize different shapes from transformers.js
  if (output?.data instanceof Float32Array) return Array.from(output.data);
  const maybeTensor = Array.isArray(output) ? output[0] : null;
  if (maybeTensor?.data instanceof Float32Array) return Array.from(maybeTensor.data);
  if (Array.isArray(output) && typeof output[0] === 'number') return output;
  throw new Error('Unknown embedding output shape');
}

export async function POST(request, ctx) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

    // 1) Ambil metadata dan file_url dari DB
    const client = sb();
    const { data: doc, error } = await client
      .from('jurnal_referensi')
      .select('id, judul, penulis, tahun, file_url')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
    if (!doc.file_url) return NextResponse.json({ error: 'File URL tidak tersedia untuk dokumen ini.' }, { status: 400 });

    // 2) Unduh PDF
    const res = await fetch(doc.file_url);
    if (!res.ok) {
      return NextResponse.json({ error: `Gagal mengunduh PDF: ${res.status} ${res.statusText}` }, { status: 502 });
    }
    const arrayBuffer = await res.arrayBuffer();

    // 3) Ekstrak teks dari PDF lalu bersihkan (persis seperti bersih_dokumen.py)
    const { chunks: pageChunks } = await extractPdfText(arrayBuffer);
    const fullText = pageChunks.join('\n');
    const mainSpan = findMainContentSpan(fullText);
    if (!mainSpan) {
      console.warn('   -> Peringatan: Konten utama tidak ditemukan untuk dokumen', id);
    }
    const cleanedContent = mainSpan ? cleanTextBlock(mainSpan) : cleanTextBlock(fullText);
    const finalChunks = makeChunks(cleanedContent);

    // 4) Siapkan metadata dari DB (sesuai contoh)
    const metadata = {
      year: doc.tahun != null ? String(doc.tahun) : '',
      title: doc.judul || '',
      author: doc.penulis || '',
    };

    // Log ringkas untuk inspeksi
  console.log('[Process] ID:', doc.id, 'metadata:', metadata, 'chunk_count:', finalChunks.length, 'text_len:', cleanedContent.length);

    // 5) Embed each chunk and upload to Supabase 'documents' table
    const embedder = await getEmbedder();
    const rows = [];
    for (let i = 0; i < finalChunks.length; i++) {
      const content = finalChunks[i];
      const out = await embedder(content, { pooling: 'mean', normalize: true });
      const vector = toVector(out);
      rows.push({
        content,
        metadata: { ...metadata, chunk_index: i, doc_id: doc.id },
        embedding: vector,
      });
    }
    let inserted = 0;
    if (rows.length) {
      const { error: insErr } = await sb().from('documents').insert(rows);
      if (insErr) throw new Error('Supabase insert error: ' + insErr.message);
      inserted = rows.length;
    }

    // Kembalikan hasil pembersihan (embed akan ditangani belakangan)
  return NextResponse.json({
      id: doc.id,
      metadata,
    text: cleanedContent,
  page_count: (cleanedContent.match(/\n\n/g) || []).length + 1, // perkiraan kasar
  chunk_count: finalChunks.length,
  inserted_count: inserted,
    length: cleanedContent.length,
    });
  } catch (err) {
    console.error('POST /api/documents/[id]/process error:', err);
    return NextResponse.json({ error: 'Gagal memproses dokumen.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
