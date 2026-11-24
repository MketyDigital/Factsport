'use client';

import { useEffect, useState } from 'react';

type Fact = { id: string; text: string; source: string; observedAt: string; verified: boolean };
type Block = { id: string; text: string; factIds: string[] };
type EpisodeDetail = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  facts: Fact[];
  rights: { dataCleared?: boolean; assetsCleared?: boolean } | null;
  scriptDraft: { blocks?: Block[] } | null;
};

export default function TVEpisodeScriptEditor({
  episodeId,
  onClose,
  onSaved,
}: {
  episodeId: string;
  onClose: () => void;
  onSaved: (id: string, updatedAt: string) => void;
}) {
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'denied' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/tv/episodes/${episodeId}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401 || response.status === 403) throw new Error('denied');
        if (!response.ok) throw new Error('error');
        const payload = await response.json() as { episode?: EpisodeDetail };
        if (!payload.episode) throw new Error('error');
        setEpisode(payload.episode);
        setBlocks(payload.episode.scriptDraft?.blocks?.length
          ? payload.episode.scriptDraft.blocks
          : [{ id: 'narration-1', text: '', factIds: [] }]);
        setState('ready');
      })
      .catch(error => {
        if (!controller.signal.aborted) setState(error instanceof Error && error.message === 'denied' ? 'denied' : 'error');
      });
    return () => controller.abort();
  }, [episodeId]);

  function updateBlock(index: number, update: Partial<Block>) {
    setBlocks(current => current.map((block, i) => i === index ? { ...block, ...update } : block));
  }

  async function save() {
    if (!episode) return;
    setState('saving');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/tv/episodes/${episodeId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: episode.updatedAt, blocks }),
      });
      const payload = await response.json() as { episode?: EpisodeDetail; error?: string };
      if (!response.ok || !payload.episode) throw new Error(payload.error || 'Script draft could not be saved.');
      setEpisode(payload.episode);
      setBlocks(payload.episode.scriptDraft?.blocks || blocks);
      onSaved(payload.episode.id, payload.episode.updatedAt);
      setMessage('Narration draft saved with source references. Rights remain blocked; no render or upload was started.');
      setState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Script draft could not be saved.');
      setState('error');
    }
  }

  return (
    <section aria-labelledby="tv-script-editor-title" className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-800">Evidence-linked script draft</p><h3 id="tv-script-editor-title" className="mt-1 text-lg font-black text-slate-950">{episode?.title || 'Episode script'}</h3></div>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Close</button>
      </div>
      {state === 'loading' && <p className="mt-4 text-xs text-slate-600" role="status">Loading verified facts…</p>}
      {state === 'denied' && <p className="mt-4 text-xs text-amber-900" role="alert">An active Factsport TV editor, publisher or media-admin membership is required.</p>}
      {state === 'error' && !episode && <p className="mt-4 text-xs text-amber-900" role="alert">Episode details could not be loaded.</p>}
      {episode && <>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          Rights state: data {episode.rights?.dataCleared ? 'cleared' : 'not cleared'}, assets {episode.rights?.assetsCleared ? 'cleared' : 'not cleared'}. Saving script text does not change either decision or make the episode publishable.
        </div>
        <div className="mt-4 space-y-4">
          {blocks.map((block, index) => <fieldset key={block.id} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-black text-slate-800">Narration block {index + 1}</legend>
            <label className="mt-2 block text-xs font-bold text-slate-700" htmlFor={`script-${block.id}`}>Original Factsport narration</label>
            <textarea id={`script-${block.id}`} value={block.text} maxLength={1200} rows={4} onChange={event => updateBlock(index, { text: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" placeholder="Write an original narration block. Each block must cite at least one verified fact." />
            <p className="mt-1 text-right text-[10px] text-slate-500">{block.text.length}/1200 characters</p>
            <div className="mt-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Verified facts cited</p>
              {episode.facts.length === 0 && <p className="mt-2 text-xs text-amber-900">No verified facts are attached to this episode yet.</p>}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{episode.facts.map(fact => <label key={fact.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700"><input type="checkbox" checked={block.factIds.includes(fact.id)} onChange={event => updateBlock(index, { factIds: event.target.checked ? [...block.factIds, fact.id] : block.factIds.filter(id => id !== fact.id) })} className="mt-0.5 accent-cyan-700"/><span><strong>{fact.text}</strong><br/><span className="text-[10px] text-slate-500">{fact.source} · {new Date(fact.observedAt).toLocaleString()}</span></span></label>)}</div>
            </div>
            {blocks.length > 1 && <button type="button" onClick={() => setBlocks(current => current.filter((_, i) => i !== index))} className="mt-3 text-xs font-bold text-rose-700 underline">Remove block</button>}
          </fieldset>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setBlocks(current => [...current, { id: `narration-${current.length + 1}`, text: '', factIds: [] }])} disabled={blocks.length >= 40 || state === 'saving'} className="min-h-10 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50">Add narration block</button>
          <button type="button" onClick={() => void save()} disabled={state === 'saving' || blocks.some(block => !block.text.trim() || block.factIds.length === 0)} className="min-h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">{state === 'saving' ? 'Saving…' : 'Save script draft'}</button>
        </div>
        {message && <p className="mt-3 text-xs text-slate-700" role="status">{message}</p>}
      </>}
    </section>
  );
}
