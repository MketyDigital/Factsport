'use client';

import { useEffect, useState } from 'react';

type Fact = { id: string; text: string; source: string; observedAt: string; verified: boolean };
type Block = { id: string; text: string; factIds: string[] };
type Scene = { id: string; position: number; label: string; startSeconds: number; durationSeconds: number; narrationText: string; factCards: Array<{ id: string; text: string; source: string; observedAt: string }>; visualTreatment: string; renderable: boolean };
type EpisodeDetail = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  facts: Fact[];
  rights: { dataCleared?: boolean; assetsCleared?: boolean } | null;
  scriptDraft: { blocks?: Block[] } | null;
  scriptReview: { decision?: string; notes?: string; reviewedAt?: string } | null;
  canReview: boolean;
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
  const [reviewNotes, setReviewNotes] = useState('');

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

  async function review(decision: 'approved' | 'changes_requested') {
    if (!episode) return;
    setState('saving');
    setMessage('');
    try {
      const response = await fetch('/api/admin/tv/episodes/' + episodeId + '/review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: episode.updatedAt, decision, notes: reviewNotes }),
      });
      const payload = await response.json() as { review?: { decision?: string; notes?: string; reviewedAt?: string }; episode?: { id: string; updatedAt: string }; error?: string };
      if (!response.ok || !payload.review || !payload.episode) throw new Error(payload.error || 'Script review could not be saved.');
      setEpisode(current => current ? { ...current, updatedAt: payload.episode!.updatedAt, scriptReview: payload.review!, canReview: false } : current);
      onSaved(payload.episode.id, payload.episode.updatedAt);
      setMessage(decision === 'approved'
        ? 'Editorial script review recorded. Rights remain blocked; this is not a render or publish approval.'
        : 'Changes requested. The episode remains rights-blocked.');
      setState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Script review could not be saved.');
      setState('error');
    }
  }

  async function buildStoryboard() {
    if (!episode) return;
    setState('saving');
    setMessage('');
    try {
      const response = await fetch('/api/admin/tv/episodes/' + episodeId + '/storyboard', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: episode.updatedAt }),
      });
      const payload = await response.json() as { scenes?: Scene[]; episode?: { id: string; updatedAt: string }; error?: string };
      if (!response.ok || !payload.episode || !payload.scenes) throw new Error(payload.error || 'Storyboard could not be saved.');
      setEpisode(current => current ? { ...current, updatedAt: payload.episode!.updatedAt, scenes: payload.scenes! } : current);
      onSaved(payload.episode.id, payload.episode.updatedAt);
      setMessage('Text-only storyboard saved. Scene timing is an estimate; no footage, audio, render, or upload was created. Rights remain blocked.');
      setState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Storyboard could not be saved.');
      setState('error');
    }
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
        {episode.scriptReview && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700" role="status">Latest editorial decision: <strong>{episode.scriptReview.decision?.replaceAll('_', ' ')}</strong>{episode.scriptReview.notes ? ' · ' + episode.scriptReview.notes : ''}</p>}
        {episode.scriptDraft?.blocks?.length && episode.canReview && <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4"><h4 className="text-xs font-black uppercase tracking-wide text-violet-950">Independent editorial review</h4><p className="mt-1 text-xs leading-5 text-violet-900">A different editor can approve this script or request changes. This review does not clear data/asset rights or permit rendering or publication.</p><label htmlFor="tv-script-review-notes" className="mt-3 block text-xs font-bold text-violet-950">Review note (optional)</label><textarea id="tv-script-review-notes" value={reviewNotes} maxLength={2000} rows={3} onChange={event => setReviewNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-violet-200 bg-white p-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"/><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void review('approved')} disabled={state === 'saving'} className="min-h-10 rounded-xl bg-violet-800 px-4 text-xs font-bold text-white disabled:opacity-50">Approve script</button><button type="button" onClick={() => void review('changes_requested')} disabled={state === 'saving'} className="min-h-10 rounded-xl border border-violet-300 px-4 text-xs font-bold text-violet-950 disabled:opacity-50">Request changes</button></div></div>}
        {episode.scriptDraft?.blocks?.length && !episode.canReview && <p className="mt-3 text-xs text-slate-600">A different editor must review this script draft.</p>}
        {episode.scriptReview?.decision === 'approved' && episode.scriptReview.scriptDigest === episode.scriptDraft?.digest && <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-xs font-black uppercase tracking-wide text-cyan-950">Storyboard draft</h4><p className="mt-1 text-xs text-cyan-900">Builds one evidence-backed 2D fact-card scene per approved narration block. This is not a video render.</p></div>
            <button type="button" onClick={() => void buildStoryboard()} disabled={state === 'saving'} className="min-h-10 rounded-xl bg-cyan-800 px-4 text-xs font-bold text-white disabled:opacity-50">{state === 'saving' ? 'Saving…' : episode.scenes.length ? 'Refresh storyboard' : 'Build storyboard'}</button></div>
          {episode.scenes.length > 0 && <ol className="mt-4 space-y-2">{episode.scenes.map(scene => <li key={scene.id} className="rounded-lg border border-cyan-100 bg-white p-3"><div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span>{scene.label}</span><span>Approx. {scene.startSeconds}s–{scene.startSeconds + scene.durationSeconds}s</span></div><p className="mt-2 text-sm leading-6 text-slate-900">{scene.narrationText}</p><div className="mt-2 flex flex-wrap gap-1">{scene.factCards.map(fact => <span key={fact.id} className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] text-cyan-950">{fact.text}</span>)}</div><p className="mt-2 text-[10px] text-slate-500">2D fact card · source-linked · render disabled</p></li>)}</ol>}
        </div>}
        {message && <p className="mt-3 text-xs text-slate-700" role="status">{message}</p>}
      </>}
    </section>
  );
}
