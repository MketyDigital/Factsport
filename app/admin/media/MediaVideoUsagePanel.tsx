'use client';

import { useState } from 'react';

type ArticleReference = {
  id: string; slug: string; title: string; status: string;
  revision_status: string; position: number; reference_type: string;
};

export default function MediaVideoUsagePanel({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleReference[]>([]);
  const [message, setMessage] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || articles.length || loading) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/media/videos/' + encodeURIComponent(videoId) + '/usage', {
        credentials: 'same-origin', cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Video usage unavailable.');
      setArticles(data.articles || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video usage unavailable.');
    } finally { setLoading(false); }
  }

  return <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
    <button type="button" onClick={() => void toggle()} className="text-[10px] font-bold text-blue-700 underline">Article usage &amp; references</button>
    {open && <div className="mt-2 space-y-2">
      {loading && <p className="text-[10px] text-slate-500">Checking references…</p>}
      {message && <p role="status" className="text-[10px] text-rose-700">{message}</p>}
      {articles.map(item => <p key={item.id + ':' + item.position + ':' + item.reference_type} className="text-[10px] text-slate-700">
        <a href={'/news/' + item.slug} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">{item.title}</a>
        <span className="ml-1 text-slate-500">· {item.reference_type} · {item.revision_status} · position {item.position}</span>
      </p>)}
      {!loading && !message && !articles.length && <p className="text-[10px] text-slate-400">No article references found.</p>}
      <p className="text-[10px] text-slate-500">Video clips are not yet supported by the scheduled social dispatcher.</p>
    </div>}
  </div>;
}
