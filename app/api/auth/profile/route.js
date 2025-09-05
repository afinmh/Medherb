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
      process.env.SUPABASE_KEY
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
      .select('id, name, email, role, password_set, is_verified, created_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create one with default 'user' role
      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            role: 'user', // Default role
            password_set: true, // Since they're logging in
            is_verified: true // Since they can login, email is verified
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
          avatar: user.user_metadata?.avatar_url || null, // Get from auth metadata
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
        avatar: user.user_metadata?.avatar_url || null, // Get from auth metadata
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
