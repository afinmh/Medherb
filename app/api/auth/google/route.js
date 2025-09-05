import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { 
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL 
    },
  });

  if (error) {
    // Jika ada error, kita bisa redirect ke halaman error atau kembali
    // dengan pesan error dalam format JSON.
    console.error("Supabase OAuth Error:", error.message);
    // Redirect kembali ke halaman utama dengan pesan error jika perlu
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
  }

  // Redirect ke URL otorisasi dari Google yang disediakan oleh Supabase
  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  // Fallback jika URL tidak ditemukan
  return NextResponse.redirect(new URL('/login?error=unknown_error', request.url));
}