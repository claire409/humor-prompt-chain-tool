'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null;

  // Check if user is already logged in and redirect if they are admin
  useEffect(() => {
    if (!supabase) return;
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentEmail(user.email ?? null);
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin, is_matrix_admin')
          .eq('id', user.id)
          .single();

        if (profile?.is_superadmin || profile?.is_matrix_admin) {
          router.push('/admin/flavors');
        } else {
          setIsDenied(true);
          setError("Access Denied: You do not have admin privileges.");
        }
      }
    };
    checkUser();

    // Catch URL errors (e.g., from your callback route)
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unauthorized') {
      setIsDenied(true);
      setError("Unauthorized: Admin clearance required.");
    }
  }, [router, supabase]);


  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full space-y-8 text-center">

        {/* Decorative Badge */}
        <div className="flex justify-center">
          <span className="px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800 shadow-sm">
            Core Humor Engine v3.0
          </span>
        </div>

        {/* Title Section */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-[0.85]">
            Prompt <br />
            <span className="text-blue-600">Chain</span> <br />
            Tool
          </h1>
          <p className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest pt-4">
            Authorized Personnel Only
          </p>
        </div>

        {/* Action Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[3rem] shadow-2xl dark:shadow-none transition-all">
          {!supabase && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
              <p className="text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-tight">
                Missing Supabase environment variables.
              </p>
            </div>
          )}
          {isDenied && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-left">
              <p className="text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-tight">
                Access denied for this account.
              </p>
              {currentEmail && (
                <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 font-bold break-all">
                  Signed in as: {currentEmail}
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                Try logging in again with a different Google account.
              </p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-black uppercase text-[11px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
          >
            <img
              src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
              className="w-5 h-5"
              alt="G"
            />
            Sign in with Google
          </button>


          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-tight">
                ⚠️ {error}
              </p>
            </div>
          )}
        </div>

        {/* Theme Status Indicator (Fulfills Assignment Requirement) */}
        <div className="flex items-center justify-center gap-2 text-slate-300 dark:text-slate-700">
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <p className="text-[9px] font-black uppercase tracking-[0.4em]">
            System Default Mode Active
          </p>
        </div>

        <footer className="pt-12">
          <p className="text-[10px] font-bold text-slate-300 dark:text-slate-800 uppercase tracking-widest">
            Almost Crack'd AI © 2026
          </p>
        </footer>
      </div>
    </main>
  );
}