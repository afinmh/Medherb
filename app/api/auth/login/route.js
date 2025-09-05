import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { email, password } = await request.json();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email first" },
      { status: 403 } // 403 Forbidden lebih cocok di sini
    );
  }

  // Get user profile with role from users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', data.user.id)
    .single();

  // If profile doesn't exist, create one with default 'user' role
  if (profileError) {
    const { data: newProfile, error: createError } = await supabase
      .from('users')
      .insert([
        {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
          email: data.user.email,
          role: 'user', // Default role
          password_set: true,
          is_verified: true
        }
      ])
      .select('role, name')
      .single();

    if (createError) {
      console.error('Profile creation error:', createError);
    }

    return NextResponse.json(
      { 
        message: "Login successful", 
        user: {
          ...data.user,
          role: newProfile?.role || 'user',
          profile: newProfile
        },
        session: data.session 
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { 
      message: "Login successful", 
      user: {
        ...data.user,
        role: profile.role,
        profile: profile
      },
      session: data.session 
    },
    { status: 200 }
  );
}