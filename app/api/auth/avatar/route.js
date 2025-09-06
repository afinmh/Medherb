import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }
    const token = authorization.split(' ')[1];

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Validate type and size (<= 3MB default)
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Ukuran file maksimal 3MB' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File harus berupa gambar' }, { status: 400 });
    }

    // Get auth user from token
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: authData, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
    }
    const userId = authData.user.id;

    // Use service role if available for storage and DB update
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

    // Determine extension
    const extFromType = file.type.split('/')[1] || 'jpg';
    const ext = extFromType.toLowerCase().split(';')[0];
    const path = `${userId}/avatar.${ext}`;

    // Upload (upsert true to overwrite)
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message || 'Gagal mengunggah avatar' }, { status: 500 });
    }

    // Public URL
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?t=${Date.now()}`; // cache-buster

    // Update users.avatar_url
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId);

    // Update auth metadata avatar_url
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.auth.admin.updateUserById(userId, { user_metadata: { avatar_url: publicUrl } });
    } else {
      await supabaseUser.auth.updateUser({ data: { avatar_url: publicUrl } });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
