import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }
    const token = authorization.split(' ')[1];
    const { password } = await request.json();

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    // Create a client with the user token in headers (to read user id)
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = userRes.user.id;

    // Prefer service role for password update (more reliable server-side)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, serviceKey);

    let updateError = null;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      updateError = error || null;
    } else {
      // Fallback: attempt using user-context update
      const { error } = await supabaseUser.auth.updateUser({ password });
      updateError = error || null;
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Gagal mengubah password' }, { status: 500 });
    }

    // Mark password_set = true in users table
    await supabaseAdmin
      .from('users')
      .update({ password_set: true })
      .eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
