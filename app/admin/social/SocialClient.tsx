'use client';

import { useEffect, useState, useTransition } from 'react';
import { cancelSocialPublication, scheduleSocialPublication } from './actions';

type Channel = { id: string; display_name: string; provider: string };
type SocialAsset = { id: string; object_key: string; content_type: string; width: number | null; height: number | null; alt_text: string | null; attribution_text: string | null };
type Publication = {
  id: string; content_text: string; status: string; scheduled_at: string | null;
  published_at: string | null; provider_post_url: string | null; display_name: string; provider: string; media_asset_ids: string[];
};

export default function SocialClient({ channels, publications }: { channels: Channel[]; publications: Publication[] }) {
  const [channelId, setChannelId] = useState(channels[0]?.id || '');
  const [contentText, setContentText] = useState('');
  const [articleId, setArticleId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [publicContentConfirmed, setPublicContentConfirmed] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<SocialAsset[]>([]);
  const [selectedMediaAssetIds, setSelectedMediaAssetIds] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setMediaLoading(true);
    fetch('/api/admin/social/media?offset=0', { cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Public media library unavailable.');
        if (active) setAvailableAssets(data.assets || []);
      })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load public media assets.'); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, []);

  function invalidatePublicApproval() {
    setPublicContentConfirmed(false);
    setIdempotencyKey('');
  }

  function schedule() {
    startTransition(async () => {
      if (!scheduledAt) { setMessage('Choose a publishing date and time.'); return; }
      const requestKey = idempotencyKey || crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(requestKey);
      const result = await scheduleSocialPublication({
        channelId, contentText, articleId: articleId.trim() || undefined,
        mediaAssetIds: selectedMediaAssetIds, linkUrl, scheduledAt: new Date(scheduledAt).toISOString(), idempotencyKey: requestKey,
        publicContentConfirmed,
      });
      if (!result.success) { setMessage(result.error); return; }
      setMessage('Social post scheduled and placed in the durable outbox. Delivery awaits the dedicated channel dispatcher.');
      setContentText(''); setArticleId(''); setSelectedMediaAssetIds([]); setLinkUrl(''); setScheduledAt(''); setIdempotencyKey(''); setPublicContentConfirmed(false);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.55fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Compose social post</h2>
          <p className="mt-1 text-sm text-slate-500">Create a public Media post without changing article publication status. Private Prediction channels use a separate system.</p>
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-bold text-slate-600">Destination channel
              <select value={channelId} onChange={e => { setChannelId(e.target.value); invalidatePublicApproval(); }} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm">
                {channels.map(channel => <option key={channel.id} value={channel.id}>{channel.display_name} · {channel.provider}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">Post copy
              <textarea value={contentText} onChange={e => { setContentText(e.target.value); invalidatePublicApproval(); }} rows={6} maxLength={10000} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Write channel-specific copy…" />
              <span className="mt-1 block text-right font-normal">{contentText.length}/10000</span>
            </label>
            <label className="block text-xs font-bold text-slate-600">Published article ID (optional)
              <input value={articleId} onChange={e => { setArticleId(e.target.value); invalidatePublicApproval(); }} placeholder="UUID of an approved published article" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-bold text-slate-700">Attach public media (up to four images)</legend>
              <p className="mb-2 text-[11px] text-slate-500">Only assets already rights-reviewed and attached to published public Media articles are available here.</p>
              {mediaLoading && <p className="text-xs text-slate-500">Loading approved media…</p>}
              {!mediaLoading && availableAssets.length === 0 && <p className="text-xs text-slate-500">No eligible public images are available yet.</p>}
              {availableAssets.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
                {availableAssets.map(asset => {
                  const checked = selectedMediaAssetIds.includes(asset.id);
                  return <label key={asset.id} className={checked ? 'flex cursor-pointer gap-2 rounded-lg border border-blue-300 bg-blue-50 p-2' : 'flex cursor-pointer gap-2 rounded-lg border border-slate-200 p-2'}>
                    <input type="checkbox" checked={checked} disabled={!checked && selectedMediaAssetIds.length >= 4} onChange={event => {
                      setSelectedMediaAssetIds(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id));
                      invalidatePublicApproval();
                    }} />
                    <img src={'/api/media/' + asset.object_key} alt={asset.alt_text || 'Public media asset'} className="h-14 w-16 rounded-md border border-slate-200 object-contain" loading="lazy" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-slate-700">{asset.object_key}</span>
                      {asset.attribution_text && <span className="mt-1 block truncate text-[10px] text-slate-500">{asset.attribution_text}</span>}
                    </span>
                  </label>;
                })}
              </div>}
              <p className="mt-2 text-right text-[10px] text-slate-500">{selectedMediaAssetIds.length}/4 selected</p>
            </fieldset>
            <label className="block text-xs font-bold text-slate-600">Link URL (optional)
              <input value={linkUrl} onChange={e => { setLinkUrl(e.target.value); invalidatePublicApproval(); }} placeholder="https://factsport.com/…" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="block text-xs font-bold text-slate-600">Schedule (your local time)
              <input type="datetime-local" value={scheduledAt} onChange={e => { setScheduledAt(e.target.value); invalidatePublicApproval(); }} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              <input type="checkbox" checked={publicContentConfirmed} onChange={e => setPublicContentConfirmed(e.target.checked)} className="mt-1" />
              <span>I confirm this is appropriate for public Factsport Media distribution: no bookmaker or betting-affiliate promotion, bonus code, wagering call-to-action, paid-prize inducement or private Prediction details. Linked content is approved for public sharing.</span>
            </label>
            <button disabled={pending || !channelId || channels.length === 0 || !publicContentConfirmed} onClick={schedule} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {pending ? 'Scheduling…' : 'Schedule post'}
            </button>
            {message && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
            {channels.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No channels have been configured. Add approved channel records before scheduling posts.</p>}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h3 className="font-black text-blue-950">Separate publishing pipeline</h3>
            <p className="mt-2 text-sm text-blue-900">Each post has its own channel, schedule, idempotency key, durable outbox record and delivery history. Article publication and match-event notifications remain separate.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-black text-amber-950">Dispatcher status</h3>
            <p className="mt-2 text-sm text-amber-900">This stage queues posts safely. It does not call Buffer, Meta or Telegram yet. A dedicated dispatcher and provider credentials must be provisioned and tested before any live delivery.</p>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><h2 className="font-black">Recent social publications</h2></div>
        <div className="divide-y divide-slate-100">
          {publications.map(post => (
            <article key={post.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
                  <span>{post.display_name}</span><span>·</span><span>{post.provider}</span><span>·</span><span>{post.status}</span>{post.media_asset_ids?.length > 0 && <span>· {post.media_asset_ids.length} image(s)</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium">{post.content_text}</p>
                <p className="mt-1 text-xs text-slate-500">{post.scheduled_at ? 'Scheduled ' + new Date(post.scheduled_at).toLocaleString() : post.published_at ? 'Published ' + new Date(post.published_at).toLocaleString() : 'Not scheduled'}</p>
                {post.provider_post_url && <a className="mt-1 inline-block text-xs font-bold text-blue-700 underline" href={post.provider_post_url} target="_blank" rel="noreferrer">View live post</a>}
              </div>
              {['draft', 'scheduled', 'queued'].includes(post.status) &&
                <button disabled={pending} onClick={() => startTransition(async () => {
                  const result = await cancelSocialPublication(post.id);
                  setMessage(result.success ? 'Post cancelled.' : result.error);
                  if (result.success) window.location.reload();
                })} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Cancel</button>}
            </article>
          ))}
          {publications.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No social posts have been created yet.</p>}
        </div>
      </section>
    </div>
  );
}
