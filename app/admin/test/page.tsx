'use client';
import { useState } from 'react';

export default function TestFlavorPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.almostcrackd.ai/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          flavor_id: 'your-flavor-id-here' // In a real app, get this from a dropdown
        })
      });
      const data = await response.json();
      setResult(data.caption);
    } catch (err) {
      alert("Error calling API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-xl mx-auto space-y-6">
      <h2 className="text-3xl font-black uppercase">Test Prompt Chain</h2>
      <input
        className="w-full p-4 rounded-2xl border dark:bg-slate-800"
        placeholder="Paste image URL here..."
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      <button
        onClick={runTest}
        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase"
      >
        {loading ? 'Generating...' : 'Generate Caption'}
      </button>
      {result && (
        <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 rounded-[2rem]">
          <p className="text-blue-600 font-black text-2xl">"{result}"</p>
        </div>
      )}
    </div>
  );
}