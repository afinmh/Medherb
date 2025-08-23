import { NextResponse } from 'next/server';
import { modelState, loadEmbedder } from '../query/route';

/**
 * Endpoint ini berfungsi sebagai "health check" untuk model embedding.
 * 1. Saat dipanggil, ia akan mengembalikan status kesiapan model.
 * 2. Jika model belum mulai dimuat, panggilan ke endpoint ini akan
 * memicu proses pemuatan di latar belakang (warming up).
 */
export async function GET() {
  // Jika model belum siap dan belum ada proses loading, mulai prosesnya.
  // Kita tidak perlu `await` di sini, biarkan berjalan di background.
  if (!modelState.isReady && !modelState.isLoading) {
    loadEmbedder();
  }

  // Kembalikan status saat ini.
  return NextResponse.json({
    isReady: modelState.isReady,
  });
}
