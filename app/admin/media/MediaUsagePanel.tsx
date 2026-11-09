'use client';

import { useState } from 'react';

type Usage = {
  relatedAssetCount: number;
  derivatives: Array<{ id: string; variant: string; objectKey: string; rightsStatus: string; isPublic: boolean }>;
  articles: Array<{ id: string; slug: string; title: string; status: string; placement: string; position: number; reference_type: string }>;
  socialPosts: Array<{ id: string; status: string; scheduled_at: string | null; published_at: string | null; provider_post_url: string | null; display_name: string; provider: string }>;
};

export default function MediaUsagePanel({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [message, setMessage] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || usage || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/media/' + encodeURIComponent(assetId) + '/usage', {
        credentials: 'same-origin', cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Usage references are unavailable.');
      setUsage(data.usage as Usage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Usage references are unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
    <button type="button" onClick={() => void toggle()} className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-700">
      <span>Usage &amp; references</span><span>{open ? '−' : '+'}</span>
    </button>
    {open && <div className="mt-3 space-y-3">
      {loading && <p className="text-xs text-slate-500">Checking article and social references…</p>}
      {message && <p role="status" className="text-xs text-rose-700">{message}</p>}
      {usage && <>
        <p className="text-[11px] text-slate-500">Checking {usage.relatedAssetCount} related original/derivative asset(s).</p>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Derivative lineage</h4>
          {usage.derivatives.length ? <ul className="mt-1 space-y-1">
            {usage.derivatives.map(item => <li key={item.id} className="text-[11px] text-slate-700">
              {item.variant.replaceAll('_', ' ')} · {item.rightsStatus} · {item.isPublic ? 'public flag on' : 'private'} · {item.id.slice(0, 8)}
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-400">No derivative lineage found.</p>}
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Editorial articles</h4>
          {usage.articles.length ? <ul className="mt-1 space-y-1">
            {usage.articles.map(item => <li key={item.id + ':' + item.placement} className="text-[11px] text-slate-700">
              <a href={'/news/' + item.slug} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">{item.title}</a>
              <span className="ml-1 text-slate-500">· {item.status} · {item.reference_type === 'team_logo' ? item.placement + ' logo' : item.placement + (item.placement === 'inline' ? ' #' + item.position : '')}</span>
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-400">No article attachments found.</p>}
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Social publications</h4>
          {usage.socialPosts.length ? <ul className="mt-1 space-y-2">
            {usage.socialPosts.map(item => <li key={item.id} className="text-[11px] text-slate-700">
              <span className="font-semibold">{item.display_name} · {item.provider}</span>
              <span className="ml-1 text-slate-500">· {item.status}</span>
              {item.scheduled_at && <span className="ml-1 text-slate-500">· scheduled {new Date(item.scheduled_at).toLocaleString()}</span>}
              {item.published_at && <span className="ml-1 text-slate-500">· published {new Date(item.published_at).toLocaleString()}</span>}
              {item.provider_post_url && <a href={item.provider_post_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 underline">Open post</a>}
            </li>)}
          </ul> : <p className="mt-1 text-[11px] text-slate-400">No social publication references found.</p>}
          {usage.socialPosts.some(item => item.status === 'published') && <p className="mt-2 rounded-md bg-amber-50 p-2 text-[10px] text-amber-800">Published third-party posts remain on their provider until separately removed. This usage view does not delete them.</p>}
        </div>
      </>}
    </div>}
  </section>;
}
