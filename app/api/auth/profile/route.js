import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Get the authorization header
    const authorization = request.headers.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: "No authorization token provided" },
        { status: 401 }
      );
    }

    const token = authorization.split(' ')[1];

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get user profile with role from users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, password_set, is_verified, created_at, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create one with default 'user' role
      const provider = user.app_metadata?.provider || 'email';
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
      const supabaseAdmin = createClient(process.env.SUPABASE_URL, adminKey);

      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            id: user.id,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            role: 'user', // Default role
            // If user logged in via Google, they may not have a password yet
            password_set: provider === 'google' ? false : true,
            is_verified: true // OAuth/email login implies verified
          }
        ])
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Failed to create user profile", details: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        user: {
          id: newProfile.id,
          email: newProfile.email,
          name: newProfile.name,
          avatar: user.user_metadata?.avatar_url || newProfile.avatar_url || null,
          avatar_url: newProfile.avatar_url || user.user_metadata?.avatar_url || null,
          role: newProfile.role,
          provider: user.app_metadata?.provider || 'email'
        },
        profile: newProfile
      });
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: user.user_metadata?.avatar_url || profile.avatar_url || null,
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || null,
        role: profile.role,
        provider: user.app_metadata?.provider || 'email'
      },
      profile: profile
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }
    const token = authorization.split(' ')[1];
    const body = await request.json();
    const { name } = body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nama tidak valid' }, { status: 400 });
    }

    const clientWithUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: userRes, error: userErr } = await clientWithUser.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = userRes.user.id;

    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    const supabase = createClient(process.env.SUPABASE_URL, adminKey);

    // Update users table
    const { error: upErr } = await supabase
      .from('users')
      .update({ name })
      .eq('id', userId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message || 'Gagal memperbarui profil' }, { status: 500 });
    }

    // Try to update auth metadata display name as well
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.auth.admin.updateUserById(userId, { user_metadata: { full_name: name } });
    } else {
      await clientWithUser.auth.updateUser({ data: { full_name: name } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
