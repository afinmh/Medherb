import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // Menggunakan modul 'fs' versi promise
import path from 'path';

/**
 * Handler untuk metode GET pada /api/documents
 * Fungsi ini akan membaca direktori dan mengembalikan daftar file PDF.
 */
export async function GET() {
  // Membuat path absolut ke direktori 'public/documents'
  const documentsDirectory = path.join(process.cwd(), 'public', 'documents');

  try {
    // Membaca semua nama file di dalam direktori
    const filenames = await fs.readdir(documentsDirectory);

    // Menyaring daftar untuk hanya menyertakan file yang berakhiran .pdf
    const pdfFiles = filenames
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .map((file) => ({ file: file })); // Memformat data sesuai kebutuhan frontend

    // Mengirim respons JSON yang berisi daftar dokumen PDF
    return NextResponse.json({ documents: pdfFiles });

  } catch (error) {
    // Menangani jika terjadi error (misalnya, direktori tidak ditemukan)
    console.error("Gagal membaca direktori dokumen:", error);

    // Mengirim respons error dengan status 500 (Internal Server Error)
    return NextResponse.json(
      { error: 'Gagal memuat daftar dokumen.' },
      { status: 500 }
    );
  }
}