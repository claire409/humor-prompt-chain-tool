'use client';

import { useEffect, useLayoutEffect, useState, use, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  ArrowUp, ArrowDown, Trash2, ChevronLeft, ChevronRight, Sparkles, Terminal, PlusCircle,
  Play, History, Loader2,
  Copy, Check, Edit3, Save, Plus, Cpu, Thermometer, CalendarDays
} from 'lucide-react';
import Link from 'next/link';

const CAPTION_PAGE_SIZE = 8;

function lookupLabel(rows: { id: number | string; slug?: string; name?: string }[], id: unknown) {
  if (id === undefined || id === null) return '—';
  const row = rows.find((r) => String(r.id) === String(id));
  return row?.slug ?? row?.name ?? `#${id}`;
}

export default function StepBuilder({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'steps' | 'test'>('steps');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- Flavor Level State ---
  const [flavorData, setFlavorData] = useState<any>(null);
  const [isEditingFlavor, setIsEditingFlavor] = useState(false);
  const [flavorBuffer, setFlavorBuffer] = useState({ slug: '', description: '' });

  // --- Step & Edit State ---
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<any>(null);

  // --- Core Data State ---
  const [stepTypes, setStepTypes] = useState<any[]>([]);
  const [inputTypes, setInputTypes] = useState<any[]>([]);
  const [outputTypes, setOutputTypes] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);

  // New Step Form State
  const [newStep, setNewStep] = useState({
    description: '',
    humor_flavor_step_type_id: '',
    llm_system_prompt: '',
    llm_user_prompt: '',
    llm_temperature: '0.7',
    llm_input_type_id: '',
    llm_output_type_id: '',
    llm_model_id: '',
  });

  const [captions, setCaptions] = useState<any[]>([]);
  const [captionPage, setCaptionPage] = useState(1);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [generatedCaptions, setGeneratedCaptions] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string>('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchCaptionHistory = async (page: number) => {
    const numericId = parseInt(params.id);
    const from = (page - 1) * CAPTION_PAGE_SIZE;
    const to = from + CAPTION_PAGE_SIZE - 1;

    const { data: captionData, count } = await supabase
      .from('captions')
      .select('*, image:images(url)', { count: 'exact' })
      .eq('humor_flavor_id', numericId)
      .order('created_datetime_utc', { ascending: false })
      .range(from, to);

    setCaptions(captionData || []);
    setTotalCount(count ?? 0);
  };

  const fetchData = async () => {
    const numericId = parseInt(params.id);

    const { data: fData } = await supabase
      .from('humor_flavors')
      .select('*')
      .eq('id', numericId)
      .single();

    if (fData) {
      setFlavorData(fData);
      setFlavorBuffer({ slug: fData.slug, description: fData.description || '' });
    }

    const [t, i, o, m] = await Promise.all([
      supabase.from('humor_flavor_step_types').select('*'),
      supabase.from('llm_input_types').select('*'),
      supabase.from('llm_output_types').select('*'),
      supabase.from('llm_models').select('*'),
    ]);

    if (t.data) {
      setStepTypes(t.data);
      setNewStep((prev) =>
        prev.humor_flavor_step_type_id
          ? prev
          : { ...prev, humor_flavor_step_type_id: String(t.data[0]?.id ?? '') }
      );
    }
    if (i.data) {
      setInputTypes(i.data);
      setNewStep((prev) =>
        prev.llm_input_type_id ? prev : { ...prev, llm_input_type_id: String(i.data[0]?.id ?? '') }
      );
    }
    if (o.data) {
      setOutputTypes(o.data);
      setNewStep((prev) =>
        prev.llm_output_type_id ? prev : { ...prev, llm_output_type_id: String(o.data[0]?.id ?? '') }
      );
    }
    if (m.data) {
      setModels(m.data);
      setNewStep((prev) =>
        prev.llm_model_id ? prev : { ...prev, llm_model_id: String(m.data[0]?.id ?? '') }
      );
    }

    const { data: stepsData } = await supabase
      .from('humor_flavor_steps')
      .select('*, humor_flavor_step_types(slug)')
      .eq('humor_flavor_id', numericId)
      .order('order_by', { ascending: true });

    if (stepsData) setSteps(stepsData || []);
  };

  useEffect(() => {
    fetchData();
  }, [params.id]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentEmail(user?.email || '');
    };
    loadUser();
  }, []);

  useLayoutEffect(() => {
    setCaptionPage(1);
  }, [params.id]);

  useEffect(() => {
    fetchCaptionHistory(captionPage);
  }, [params.id, captionPage]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Flavor Actions ---
  const saveFlavorEdits = async () => {
    const { error } = await supabase
      .from('humor_flavors')
      .update({
        slug: flavorBuffer.slug,
        description: flavorBuffer.description
      })
      .eq('id', params.id);

    if (!error) {
      setFlavorData({ ...flavorData, ...flavorBuffer });
      setIsEditingFlavor(false);
    } else {
      alert(error.message);
    }
  };

  const deleteFlavor = async () => {
    if (!confirm("⚠️ DANGER: This will permanently delete this Flavor and ALL its logic steps. This cannot be undone. Proceed?")) return;
    const { error } = await supabase.from('humor_flavors').delete().eq('id', params.id);
    if (!error) {
      router.push('/admin/flavors');
    } else {
      alert(error.message);
    }
  };

  // --- Step Actions ---
  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepTypes.length || !models.length) return alert("System data loading...");

    setIsAddingStep(true);
    try {
      const temp = parseFloat(newStep.llm_temperature);
      const { data, error } = await supabase
        .from('humor_flavor_steps')
        .insert([{
          humor_flavor_id: parseInt(params.id),
          humor_flavor_step_type_id: newStep.humor_flavor_step_type_id,
          description: newStep.description,
          llm_system_prompt: newStep.llm_system_prompt,
          llm_user_prompt: newStep.llm_user_prompt,
          llm_temperature: Number.isFinite(temp) ? temp : 0.7,
          llm_input_type_id: newStep.llm_input_type_id ? parseInt(newStep.llm_input_type_id, 10) : inputTypes[0]?.id,
          llm_output_type_id: newStep.llm_output_type_id ? parseInt(newStep.llm_output_type_id, 10) : outputTypes[0]?.id,
          llm_model_id: newStep.llm_model_id ? parseInt(newStep.llm_model_id, 10) : models[0]?.id,
          order_by: steps.length + 1
        }])
        .select('*, humor_flavor_step_types(slug)')
        .single();

      if (error) throw error;
      setSteps([...steps, data]);
      setNewStep({
        ...newStep,
        description: '',
        llm_system_prompt: '',
        llm_user_prompt: '',
        llm_temperature: '0.7',
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAddingStep(false);
    }
  };

  const deleteStep = async (id: string) => {
    if (!confirm("Delete this step?")) return;
    const { error } = await supabase.from('humor_flavor_steps').delete().eq('id', id);
    if (error) return;

    const remaining = steps
      .filter((s) => s.id !== id)
      .sort((a, b) => (a.order_by ?? 0) - (b.order_by ?? 0));

    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('humor_flavor_steps')
        .update({ order_by: i + 1 })
        .eq('id', remaining[i].id);
    }

    setSteps(remaining.map((s, i) => ({ ...s, order_by: i + 1 })));
  };

  const moveStep = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const updatedSteps = [...steps];
    const [movedItem] = updatedSteps.splice(index, 1);
    updatedSteps.splice(newIndex, 0, movedItem);

    setSteps(updatedSteps);

    for (let i = 0; i < updatedSteps.length; i++) {
      await supabase.from('humor_flavor_steps')
        .update({ order_by: i + 1 })
        .eq('id', updatedSteps[i].id);
    }
  };

  const startEditingStep = (step: any) => {
    setEditingStepId(step.id);
    setEditBuffer({
      ...step,
      humor_flavor_step_type_id: String(step.humor_flavor_step_type_id ?? ''),
      llm_input_type_id: step.llm_input_type_id != null ? String(step.llm_input_type_id) : '',
      llm_output_type_id: step.llm_output_type_id != null ? String(step.llm_output_type_id) : '',
      llm_model_id: step.llm_model_id != null ? String(step.llm_model_id) : '',
      llm_temperature: step.llm_temperature != null && step.llm_temperature !== '' ? String(step.llm_temperature) : '0.7',
    });
  };

  const saveStepEdit = async () => {
    const t = parseFloat(String(editBuffer.llm_temperature ?? ''));
    const { error } = await supabase
      .from('humor_flavor_steps')
      .update({
        description: editBuffer.description,
        llm_system_prompt: editBuffer.llm_system_prompt,
        llm_user_prompt: editBuffer.llm_user_prompt,
        humor_flavor_step_type_id: editBuffer.humor_flavor_step_type_id,
        llm_temperature: Number.isFinite(t) ? t : null,
        llm_input_type_id: editBuffer.llm_input_type_id != null && editBuffer.llm_input_type_id !== ''
          ? parseInt(String(editBuffer.llm_input_type_id), 10)
          : null,
        llm_output_type_id: editBuffer.llm_output_type_id != null && editBuffer.llm_output_type_id !== ''
          ? parseInt(String(editBuffer.llm_output_type_id), 10)
          : null,
        llm_model_id: editBuffer.llm_model_id != null && editBuffer.llm_model_id !== ''
          ? parseInt(String(editBuffer.llm_model_id), 10)
          : null,
      })
      .eq('id', editBuffer.id);

    if (!error) {
      setEditingStepId(null);
      fetchData();
    }
  };

  const runTest = async () => {
    if (!testFile) return alert('Please choose an image to upload');

    setIsTesting(true);
    try {
      const formData = new FormData();
      formData.append('image', testFile);
      formData.append('humorFlavorId', params.id);

      const response = await fetch('/api/staging-captions', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }

      setGeneratedCaptions(
        Array.isArray(data.captions) ? data.captions.slice(0, 5) : []
      );
      setGeneratedImageUrl(typeof data.imageUrl === 'string' ? data.imageUrl : null);
      await fetchData();
      setCaptionPage(1);
      await fetchCaptionHistory(1);
      setTestFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Test Execution Error:', err);
      alert(`Failed to generate captions: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 bg-white dark:bg-slate-950 min-h-screen transition-colors duration-500">
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {currentEmail && (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Signed in as: <span className="normal-case text-slate-600 dark:text-slate-300">{currentEmail}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      <Link href="/admin/flavors" className="flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black uppercase text-[10px] tracking-widest transition-all">
        <ChevronLeft size={14}/> Back to Registry
      </Link>

      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-10">
        <div className="space-y-4 flex-1">
          {isEditingFlavor ? (
            <div className="space-y-4 max-w-2xl animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-blue-600 px-1">Flavor Slug</label>
                <input
                  value={flavorBuffer.slug}
                  onChange={e => setFlavorBuffer({...flavorBuffer, slug: e.target.value})}
                  className="text-4xl font-black uppercase tracking-tighter w-full bg-slate-50 dark:bg-slate-900 border-2 border-blue-500 rounded-2xl px-4 py-2 outline-none dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 px-1">Description</label>
                <textarea
                  value={flavorBuffer.description}
                  onChange={e => setFlavorBuffer({...flavorBuffer, description: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveFlavorEdits} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20"><Save size={14}/> Commit Changes</button>
                <button onClick={() => setIsEditingFlavor(false)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="flex items-center gap-4">
                <h2 className="text-5xl font-black uppercase tracking-tighter dark:text-white leading-none">
                  {flavorData?.slug || 'Loading...'} <span className="text-blue-600">Studio</span>
                </h2>
              </div>
              <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-3xl text-sm font-medium leading-relaxed">
                {flavorData?.description || 'Build and iterate on your generative humor logic.'}
              </p>
              <div className="flex items-center gap-6 mt-6">
                <button
                  onClick={() => setIsEditingFlavor(true)}
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Edit3 size={14}/> Edit Details
                </button>
                <button
                  onClick={deleteFlavor}
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14}/> Delete Flavor
                </button>
                <span className="text-[9px] text-slate-300 dark:text-slate-700 font-black uppercase tracking-widest">ID: {params.id}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl shadow-inner h-fit border border-slate-200/50 dark:border-slate-800">
          <button onClick={() => setActiveTab('steps')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'steps' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-lg' : 'text-slate-500'}`}>Logic Chain</button>
          <button onClick={() => setActiveTab('test')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'test' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-lg' : 'text-slate-500'}`}>History & Test</button>
        </div>
      </header>

      {/* --- TAB 1: STEPS --- */}
      {activeTab === 'steps' && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="space-y-8">
            {steps.map((step, index) => {
              const isEditing = editingStepId === step.id;
              return (
                <div key={step.id} className={`bg-slate-50 dark:bg-slate-900 border ${isEditing ? 'border-blue-500 ring-4 ring-blue-500/5' : 'border-slate-200 dark:border-slate-800'} rounded-[2.5rem] overflow-hidden transition-all relative`}>
                  <div className="absolute left-6 top-8">
                    <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-xs font-black border-2 border-white dark:border-slate-900">{index + 1}</span>
                  </div>

                  <div className="pl-16 p-6 bg-white dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveStep(index, 'up')} className="p-1 hover:text-blue-600 transition-colors text-slate-300"><ArrowUp size={14}/></button>
                        <button onClick={() => moveStep(index, 'down')} className="p-1 hover:text-blue-600 transition-colors text-slate-300"><ArrowDown size={14}/></button>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Description</label>
                          {isEditing ? (
                            <input value={editBuffer.description} onChange={e => setEditBuffer({...editBuffer, description: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-sm font-bold dark:text-white outline-none border border-blue-500/50" />
                          ) : (
                            <p className="font-black uppercase text-md dark:text-white truncate">{step.description}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Type</label>
                          {isEditing ? (
                            <select value={editBuffer.humor_flavor_step_type_id} onChange={e => setEditBuffer({...editBuffer, humor_flavor_step_type_id: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-xs font-bold uppercase text-blue-600">
                               {stepTypes.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
                            </select>
                          ) : (
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-tighter">{step.humor_flavor_step_types?.slug}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1"><Thermometer size={10}/> Temp</label>
                          {isEditing ? (
                            <input type="number" step="0.01" min={0} max={2} value={editBuffer.llm_temperature} onChange={e => setEditBuffer({...editBuffer, llm_temperature: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-xs font-mono dark:text-white outline-none border border-blue-500/50" />
                          ) : (
                            <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{step.llm_temperature != null ? String(step.llm_temperature) : '—'}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Input</label>
                          {isEditing ? (
                            <select value={editBuffer.llm_input_type_id} onChange={e => setEditBuffer({...editBuffer, llm_input_type_id: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-[10px] font-bold dark:text-white outline-none border border-blue-500/50">
                              {inputTypes.map((it) => <option key={it.id} value={it.id}>{it.slug ?? it.name ?? it.id}</option>)}
                            </select>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{lookupLabel(inputTypes, step.llm_input_type_id)}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Output</label>
                          {isEditing ? (
                            <select value={editBuffer.llm_output_type_id} onChange={e => setEditBuffer({...editBuffer, llm_output_type_id: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-[10px] font-bold dark:text-white outline-none border border-blue-500/50">
                              {outputTypes.map((ot) => <option key={ot.id} value={ot.id}>{ot.slug ?? ot.name ?? ot.id}</option>)}
                            </select>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{lookupLabel(outputTypes, step.llm_output_type_id)}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1"><Cpu size={10}/> Model</label>
                          {isEditing ? (
                            <select value={editBuffer.llm_model_id} onChange={e => setEditBuffer({...editBuffer, llm_model_id: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-950 p-2 rounded-lg text-[10px] font-bold dark:text-white outline-none border border-blue-500/50">
                              {models.map((mo) => <option key={mo.id} value={mo.id}>{mo.slug ?? mo.name ?? mo.id}</option>)}
                            </select>
                          ) : (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{lookupLabel(models, step.llm_model_id)}</p>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {isEditing ? (
                        <button onClick={saveStepEdit} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Save size={18}/></button>
                      ) : (
                        <>
                          <button onClick={() => startEditingStep(step)} className="p-3 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                          <button onClick={() => deleteStep(step.id)} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                        </>
                      )}
                    </div>
                    </div>
                  </div>

                  <div className="p-8 pl-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Terminal size={12}/> System Prompt</label>
                      {isEditing ? (
                        <textarea value={editBuffer.llm_system_prompt} onChange={e => setEditBuffer({...editBuffer, llm_system_prompt: e.target.value})} className="w-full h-32 bg-white dark:bg-slate-950 border border-blue-500/50 rounded-2xl p-4 text-xs font-mono dark:text-slate-300 outline-none" />
                      ) : (
                        <div className="h-32 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-500 dark:text-slate-400 overflow-auto whitespace-pre-wrap">{step.llm_system_prompt}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Sparkles size={12}/> User Prompt</label>
                      {isEditing ? (
                        <textarea value={editBuffer.llm_user_prompt} onChange={e => setEditBuffer({...editBuffer, llm_user_prompt: e.target.value})} className="w-full h-32 bg-white dark:bg-slate-950 border border-blue-500/50 rounded-2xl p-4 text-xs font-mono dark:text-slate-300 outline-none" />
                      ) : (
                        <div className="h-32 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-500 dark:text-slate-400 overflow-auto whitespace-pre-wrap">{step.llm_user_prompt}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* --- NEW STEP FORM --- */}
          <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl border border-white/5 space-y-8">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><PlusCircle className="text-blue-500"/> Draft New Step</h3>
            <form onSubmit={handleAddStep} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Label</label>
                  <input required placeholder="Description..." value={newStep.description} onChange={e => setNewStep({...newStep, description: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Logic Type</label>
                  <select value={newStep.humor_flavor_step_type_id} onChange={e => setNewStep({...newStep, humor_flavor_step_type_id: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-bold uppercase text-blue-400 outline-none">
                    {stepTypes.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[8px] font-black uppercase text-slate-500 px-1">System Context</label>
                 <textarea placeholder="Instruction..." value={newStep.llm_system_prompt} onChange={e => setNewStep({...newStep, llm_system_prompt: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-xs font-mono h-[116px] outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Temperature</label>
                  <input type="number" step="0.01" min={0} max={2} value={newStep.llm_temperature} onChange={e => setNewStep({...newStep, llm_temperature: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Input type</label>
                  <select value={newStep.llm_input_type_id} onChange={e => setNewStep({...newStep, llm_input_type_id: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                    {inputTypes.map((it) => <option key={it.id} value={it.id}>{it.slug ?? it.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Output type</label>
                  <select value={newStep.llm_output_type_id} onChange={e => setNewStep({...newStep, llm_output_type_id: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                    {outputTypes.map((ot) => <option key={ot.id} value={ot.id}>{ot.slug ?? ot.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 px-1">Model</label>
                  <select value={newStep.llm_model_id} onChange={e => setNewStep({...newStep, llm_model_id: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                    {models.map((mo) => <option key={mo.id} value={mo.id}>{mo.slug ?? mo.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 px-1">User Query</label>
                <textarea placeholder="User input logic..." value={newStep.llm_user_prompt} onChange={e => setNewStep({...newStep, llm_user_prompt: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-xs font-mono min-h-[80px] outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={isAddingStep} className="md:col-span-2 bg-blue-600 hover:bg-blue-500 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                {isAddingStep ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                {isAddingStep ? 'Syncing...' : 'Add Step to Chain'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* --- TAB 2: TEST & HISTORY --- */}
      {activeTab === 'test' && (
        <div className="grid grid-cols-12 gap-10 animate-in slide-in-from-right-4 duration-500">
          <div className="col-span-12 lg:col-span-5 space-y-8">
            <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl sticky top-8 border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><Play size={20} className="text-blue-500 fill-blue-500"/> API Tester</h3>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic mt-1">Live Endpoint Verification</p>
                </div>
              </div>
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTestFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest file:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {generatedCaptions.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-slate-800/80 p-5 space-y-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Latest staging run (up to 5 captions)</p>
                    {generatedImageUrl && (
                      <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-white/5">
                        <img src={generatedImageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <ul className="space-y-3">
                      {generatedCaptions.map((line, i) => (
                        <li
                          key={`${i}-${line.slice(0, 24)}`}
                          className="text-sm font-bold italic leading-relaxed text-blue-100 border-l-2 border-blue-500 pl-3"
                        >
                          &ldquo;{line}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isTesting && (
                  <p className="text-[11px] text-slate-400 leading-relaxed px-1">
                    This may take a while — the pipeline uploads your image and runs the full caption chain.
                  </p>
                )}
                <button
                  onClick={runTest}
                  disabled={isTesting}
                  className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                >
                  {isTesting ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                  {isTesting ? 'Generating...' : 'Trigger Generator'}
                </button>
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-black uppercase tracking-tight dark:text-white flex items-center gap-3">
                <History className="text-slate-400"/> Execution Log
              </h3>
              <span className="bg-slate-100 dark:bg-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {totalCount.toLocaleString()} Total Captions
              </span>
            </div>

            <div className="grid gap-6">
              {captions.length > 0 ? captions.map((c) => (
                <div key={c.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row transition-all hover:border-blue-500/20 shadow-sm group">
                  <div className="w-full md:w-40 h-40 bg-slate-200 dark:bg-slate-800 flex-shrink-0 overflow-hidden">
                    {c.image?.url && <img src={c.image.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
                  </div>
                  <div className="p-8 flex-1 flex flex-col justify-between">
                    <p className="text-md font-bold dark:text-slate-100 italic leading-relaxed mb-6">"{c.content}"</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter italic flex items-center gap-2">
                        <CalendarDays size={10} className="text-blue-500"/> {new Date(c.created_datetime_utc).toLocaleString()}
                      </span>
                      <button onClick={() => handleCopy(c.content, c.id)} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors">
                        {copiedId === c.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        <span>{copiedId === c.id ? 'Saved' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                  <p className="text-slate-300 dark:text-slate-700 font-black uppercase text-[10px] tracking-widest">No history recorded for this flavor</p>
                </div>
              )}
            </div>

            {totalCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-2 pt-4 pb-20 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Page {captionPage} of {Math.max(1, Math.ceil(totalCount / CAPTION_PAGE_SIZE))}
                  <span className="text-slate-500 font-medium normal-case ml-2">
                    (showing {(captionPage - 1) * CAPTION_PAGE_SIZE + 1}–{Math.min(captionPage * CAPTION_PAGE_SIZE, totalCount)} of {totalCount})
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={captionPage <= 1}
                    onClick={() => setCaptionPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={captionPage >= Math.max(1, Math.ceil(totalCount / CAPTION_PAGE_SIZE))}
                    onClick={() => setCaptionPage((p) => p + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}