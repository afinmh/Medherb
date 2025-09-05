import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  // 1. Ambil data dari body request
  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/verify-email.html`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 2. Kirim respons menggunakan NextResponse
  return NextResponse.json(
    { message: "Check your email to verify your account" },
    { status: 200 }
  );
}