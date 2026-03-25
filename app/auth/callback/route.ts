import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (payload) => payload.forEach(c => cookieStore.set(c.name, c.value, c.options))
        }
      }
    );

    // Exchange the code for a session
    const { data: { user }, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (user && !authError) {
      // Check for specialized admin roles
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin, is_matrix_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_superadmin || profile?.is_matrix_admin) {
        // Success! Send to the Flavor Manager
        return NextResponse.redirect(`${origin}/admin/flavors`);
      }

      // Not authorized: clear session so they can retry with another account cleanly.
      await supabase.auth.signOut();
    }
  }

  // If anything fails or they aren't an admin, send back to login
  return NextResponse.redirect(`${origin}?error=unauthorized`);
}