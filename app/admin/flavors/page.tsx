'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation'; // <-- Added this
import {
  PlusCircle, Search, Sparkles, Terminal, Hash,
  ChevronRight, Database, Fingerprint, AlignLeft,
  LayoutGrid, Activity, Copy
} from 'lucide-react';
import Link from 'next/link';

export default function FlavorRegistry() {
  const router = useRouter(); // <-- Initialize router
  const [flavors, setFlavors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string>('');

  const [newFlavor, setNewFlavor] = useState({
    slug: '',
    description: ''
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null;

  const fetchFlavors = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('humor_flavors')
      .select('*')
      .order('id', { ascending: true });
    if (data) setFlavors(data);
  };

  useEffect(() => { if (supabase) fetchFlavors(); }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentEmail(user?.email || '');
    };
    loadUser();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleCreateFlavor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    // Ensure slug is clean one last time
    const cleanSlug = newFlavor.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');

    const { data, error } = await supabase
      .from('humor_flavors')
      .insert([{ ...newFlavor, slug: cleanSlug }])
      .select();

    if (error) {
      console.error("Supabase error:", error.message);
      alert("Error: " + error.message);
      return;
    }

    if (data && data[0]) {
      setIsAdding(false);
      setNewFlavor({ slug: '', description: '' });
      // Redirect to the new flavor's detail page immediately
      router.push(`/admin/flavors/${data[0].id}`);
    }
  };

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const uniqueSlug = (desired: string) => {
    const base = slugify(desired);
    if (!base) return '';
    const taken = new Set(flavors.map((f) => String(f.slug)));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  };

  const handleDuplicateFlavor = async (flavor: any) => {
    if (!supabase) return;

    const defaultSlug = `${String(flavor.slug)}-copy`;
    const input = prompt('New flavor slug (must be unique):', defaultSlug);
    if (input == null) return;

    const newSlug = uniqueSlug(input);
    if (!newSlug) {
      alert('Please provide a valid slug.');
      return;
    }

    const { data: newFlavorRow, error: flavorErr } = await supabase
      .from('humor_flavors')
      .insert([{ slug: newSlug, description: flavor.description }])
      .select('*')
      .single();

    if (flavorErr || !newFlavorRow) {
      alert(flavorErr?.message || 'Failed to duplicate flavor.');
      return;
    }

    const { data: stepsData, error: stepsErr } = await supabase
      .from('humor_flavor_steps')
      .select('*')
      .eq('humor_flavor_id', flavor.id)
      .order('order_by', { ascending: true });

    if (stepsErr) {
      alert(stepsErr.message);
      return;
    }

    const rows = (stepsData || []).map((s: any) => ({
      humor_flavor_id: newFlavorRow.id,
      humor_flavor_step_type_id: s.humor_flavor_step_type_id,
      description: s.description,
      llm_system_prompt: s.llm_system_prompt,
      llm_user_prompt: s.llm_user_prompt,
      llm_temperature: s.llm_temperature,
      llm_input_type_id: s.llm_input_type_id,
      llm_output_type_id: s.llm_output_type_id,
      llm_model_id: s.llm_model_id,
      order_by: s.order_by,
    }));

    if (rows.length > 0) {
      const { error: insertStepsErr } = await supabase.from('humor_flavor_steps').insert(rows);
      if (insertStepsErr) {
        alert(insertStepsErr.message);
        return;
      }
    }

    await fetchFlavors();
    router.push(`/admin/flavors/${newFlavorRow.id}`);
  };

  const filteredFlavors = flavors.filter(f =>
    f.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.id.toString().includes(searchQuery)
  );

  return (
    <div suppressHydrationWarning className="p-8 max-w-6xl mx-auto space-y-12 bg-white dark:bg-slate-950 min-h-screen transition-colors duration-500">
      {/* Header Section */}
      {!supabase && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          Missing Supabase environment variables. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-100 dark:border-slate-800 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <Database size={24} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">System Registry</span>
          </div>
          <h1 className="text-[clamp(2.25rem,9vw,5.5rem)] font-black uppercase tracking-tighter dark:text-white leading-none whitespace-nowrap">
            Humor <span className="text-blue-600">Flavors</span>
          </h1>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div className="flex flex-col items-end gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {currentEmail && (
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Signed in as: <span className="text-slate-600 dark:text-slate-300 normal-case">{currentEmail}</span>
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
            >
              Sign Out
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID or Slug..."
                className="bg-slate-100 dark:bg-slate-900 border-none rounded-2xl py-4 pl-12 pr-6 text-sm font-bold w-64 focus:ring-2 focus:ring-blue-500 transition-all outline-none dark:text-white"
              />
            </div>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 ${
                isAdding ? 'bg-slate-200 dark:bg-slate-800 text-slate-600' : 'bg-blue-600 text-white shadow-blue-500/20'
              }`}
            >
              <PlusCircle size={24} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </div>
      </header>

      {/* Add New Flavor Form */}
      {isAdding && (
        <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl animate-in slide-in-from-top-4 duration-500 border border-white/5">
          <form onSubmit={handleCreateFlavor} className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
              <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                <Sparkles className="text-blue-500" /> New System Persona
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <Fingerprint size={12}/> Slug Name
                </label>
                <input
                  required
                  placeholder="e.g. sarcastic-roast"
                  value={newFlavor.slug}
                  onChange={(e) => setNewFlavor({
                    ...newFlavor,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                  <AlignLeft size={12}/> Description
                </label>
                <input
                  required
                  placeholder="The persona's primary humor directive..."
                  value={newFlavor.description}
                  onChange={(e) => setNewFlavor({...newFlavor, description: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3">
              Deploy to Engine <ArrowRight size={16}/>
            </button>
          </form>
        </section>
      )}

      {/* Grid of Flavors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
        {filteredFlavors.map((flavor) => (
          <Link
            key={flavor.id}
            href={`/admin/flavors/${flavor.id}`}
            className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[3rem] hover:bg-white dark:hover:bg-slate-800 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden"
          >
            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/30 border-2 border-white dark:border-slate-950 transition-transform group-hover:scale-110">
                  <Hash size={12} className="opacity-70" />
                  <span className="text-xs font-black tracking-tighter italic">
                    {flavor.id.toString().padStart(3, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDuplicateFlavor(flavor);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-200/50 dark:bg-slate-800/50 text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Duplicate flavor + steps"
                  >
                    <Copy size={10} />
                    Duplicate
                  </button>
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full text-[8px] font-black uppercase text-slate-400 group-hover:text-blue-500 transition-colors">
                    <Activity size={10}/> Active
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-600/60 flex items-center gap-1.5 tracking-widest">
                  <Fingerprint size={10}/> Slug
                </label>
                <h2 className="text-xl font-black dark:text-white group-hover:text-blue-600 transition-colors leading-none font-mono lowercase">
                  {flavor.slug}
                </h2>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5 tracking-widest">
                  <AlignLeft size={10}/> Description
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold line-clamp-2 leading-relaxed uppercase tracking-tight">
                  {flavor.description}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-blue-600 transition-all translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100">
                <Terminal size={12} /> Studio Editor <ChevronRight size={12}/>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Just in case ArrowRight wasn't imported
const ArrowRight = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
);