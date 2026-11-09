'use client';

import { useEffect, useState, useTransition } from 'react';
import { cancelSocialPublication, reconcileSocialDelivery, scheduleSocialPublication, updateSocialChannel } from './actions';

type Channel = { id: string; channel_key: string; display_name: string; provider: 'meta' | 'telegram' | 'buffer' | 'make'; is_enabled: boolean; supports_media: boolean; settings: Record<string, unknown> };
type SocialAsset = { id: string; object_key: string; content_type: string; width: number | null; height: number | null; alt_text: string | null; attribution_text: string | null };
type Publication = {
  id: string; content_text: string; status: string; scheduled_at: string | null;
  published_at: string | null; provider_post_url: string | null; display_name: string; provider: string; media_asset_ids: string[];
};

type Reconciliation = {
  publication_id: string; content_text: string; publication_status: string;
  scheduled_at: string | null; publication_provider_post_id: string | null; provider_post_url: string | null;
  publication_error_code: string | null; publication_error_message: string | null;
  display_name: string; provider: string; outbox_id: string; outbox_status: string;
  attempts: number; outbox_error_code: string | null; attempt_number: number; outcome: string;
  provider_request_id: string | null; attempt_provider_post_id: string | null;
  provider_response: Record<string, unknown>; attempt_error_code: string | null;
  attempt_error_message: string | null; started_at: string; finished_at: string | null;
};

export default function SocialClient({ channels, publications, reconciliations }: { channels: Channel[]; publications: Publication[]; reconciliations: Reconciliation[] }) {
  const [channelId, setChannelId] = useState(channels.find(channel => channel.is_enabled)?.id || '');
  const [channelDrafts, setChannelDrafts] = useState<Record<string, { isEnabled: boolean; supportsMedia: boolean; providerSetting: string }>>(() => Object.fromEntries(channels.map(channel => [channel.id, {
    isEnabled: channel.is_enabled,
    supportsMedia: channel.supports_media,
    providerSetting: channel.provider === 'meta' ? String(channel.settings.page_id || '') :
      channel.provider === 'buffer' ? String(channel.settings.profile_id || '') :
      channel.provider === 'telegram' ? (Array.isArray(channel.settings.chat_ids) ? channel.settings.chat_ids.join(', ') : '') :
      String(channel.settings.route_key || ''),
  }])));
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
  const [reconciliationDrafts, setReconciliationDrafts] = useState<Record<string, {
    providerPostId: string; providerPostUrl: string; evidence: string; confirmed: boolean;
  }>>({});

  useEffect(() => {
    if (!channels.some(channel => channel.supports_media)) return;
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
  }, [channels]);

  const selectedChannel = channels.find(channel => channel.id === channelId && channel.is_enabled);

  function updateChannelDraft(channelId: string, patch: Partial<{ isEnabled: boolean; supportsMedia: boolean; providerSetting: string }>) {
    setChannelDrafts(current => ({ ...current, [channelId]: { ...current[channelId], ...patch } }));
  }

  function saveChannel(channel: Channel) {
    const draft = channelDrafts[channel.id];
    if (!draft) return;
    startTransition(async () => {
      const result = await updateSocialChannel({
        channelId: channel.id, isEnabled: draft.isEnabled,
        supportsMedia: draft.supportsMedia, providerSetting: draft.providerSetting,
      });
      if (!result.success) { setMessage(result.error); return; }
      setMessage('Channel configuration saved. Any activation still requires the configured dispatcher and provider readiness gates.');
      window.location.reload();
    });
  }

  function invalidatePublicApproval() {
    setPublicContentConfirmed(false);
    setIdempotencyKey('');
  }

  function reconciliationDraft(publicationId: string) {
    return reconciliationDrafts[publicationId] || { providerPostId: '', providerPostUrl: '', evidence: '', confirmed: false };
  }

  function updateReconciliationDraft(publicationId: string, patch: Partial<{
    providerPostId: string; providerPostUrl: string; evidence: string; confirmed: boolean;
  }>) {
    setReconciliationDrafts(current => ({
      ...current,
      [publicationId]: { ...(current[publicationId] || { providerPostId: '', providerPostUrl: '', evidence: '', confirmed: false }), ...patch },
    }));
  }

  function reconcileDelivery(item: Reconciliation, decision: 'confirmed_published' | 'confirmed_not_published') {
    const draft = reconciliationDraft(item.publication_id);
    startTransition(async () => {
      const result = await reconcileSocialDelivery({
        publicationId: item.publication_id,
        decision,
        providerPostId: draft.providerPostId,
        providerPostUrl: draft.providerPostUrl,
        evidence: draft.evidence,
        confirmed: draft.confirmed,
      });
      setMessage(result.success
        ? (decision === 'confirmed_published'
          ? 'Delivery marked published from the verified provider receipt. The original ambiguous attempt remains in the audit history.'
          : 'No provider post was found. The post has been returned to the durable retry queue with an audited operator decision.')
        : result.error);
      if (result.success) window.location.reload();
    });
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Social channel connections</h2>
        <p className="mt-1 text-xs text-slate-500">Manage non-secret account routing only. Access tokens, bot tokens and webhook URLs belong in secure Cloudflare/Logic Apps secrets, never in this database or browser form. Channels stay disabled until the dispatcher and provider readiness checks pass.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {channels.map(channel => {
            const draft = channelDrafts[channel.id];
            const settingLabel = channel.provider === 'meta' ? 'Meta Page ID' : channel.provider === 'buffer' ? 'Buffer profile/channel ID' : channel.provider === 'telegram' ? 'Telegram chat IDs (comma separated)' : 'Make route key';
            return <div key={channel.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-bold text-slate-900">{channel.display_name}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{channel.channel_key} · {channel.provider}</p></div>
                <span className={channel.is_enabled ? 'rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600'}>{channel.is_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <label className="mt-3 block text-xs font-bold text-slate-600">{settingLabel}
                <input value={draft?.providerSetting || ''} onChange={event => updateChannelDraft(channel.id, { providerSetting: event.target.value })} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
              </label>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!draft?.isEnabled} onChange={event => updateChannelDraft(channel.id, { isEnabled: event.target.checked })} /> Enable channel</label>
                <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!draft?.supportsMedia} onChange={event => updateChannelDraft(channel.id, { supportsMedia: event.target.checked })} /> Image delivery verified</label>
              </div>
              <button type="button" disabled={pending} onClick={() => saveChannel(channel)} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Save channel settings</button>
            </div>;
          })}
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.55fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Compose social post</h2>
          <p className="mt-1 text-sm text-slate-500">Create a public Media post without changing article publication status. Private Prediction channels use a separate system.</p>
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-bold text-slate-600">Destination channel
              <select value={channelId} onChange={e => { setChannelId(e.target.value); setSelectedMediaAssetIds([]); invalidatePublicApproval(); }} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm">
                {channels.filter(channel => channel.is_enabled).map(channel => <option key={channel.id} value={channel.id}>{channel.display_name} · {channel.provider}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-600">Post copy
              <textarea value={contentText} onChange={e => { setContentText(e.target.value); invalidatePublicApproval(); }} rows={6} maxLength={10000} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Write channel-specific copy…" />
              <span className="mt-1 block text-right font-normal">{contentText.length}/10000</span>
            </label>
            <label className="block text-xs font-bold text-slate-600">Published article ID (optional)
              <input value={articleId} onChange={e => { setArticleId(e.target.value); invalidatePublicApproval(); }} placeholder="UUID of an approved published article" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            {selectedChannel?.supports_media ? <fieldset className="rounded-xl border border-slate-200 p-3">
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
            </fieldset> : <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">Image attachments are disabled for this channel until its provider has passed image-delivery verification.</p>}
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
            <p className="mt-2 text-sm text-amber-900">Posts enter a durable outbox and are delivered only by the dedicated dispatcher. Live delivery remains disabled until its isolated database identity, provider credentials, secure Logic Apps/APIM adapter and private-destination end-to-end tests are verified. Ambiguous provider results are dead-lettered for manual reconciliation; they are never blindly replayed.</p>
          </div>
        </aside>
      </section>


      {reconciliations.length > 0 && <section className="overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-sm">
        <div className="border-b border-amber-200 bg-amber-50 p-4">
          <h2 className="font-black text-amber-950">Delivery reconciliation · {reconciliations.length}</h2>
          <p className="mt-1 text-xs text-amber-900">These posts have an ambiguous provider result. A provider may already have accepted them. Verify the provider account before taking action; no automatic replay is allowed.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {reconciliations.map(item => {
            const draft = reconciliationDraft(item.publication_id);
            const hasProviderReceipt = !!(item.attempt_provider_post_id || item.publication_provider_post_id || item.provider_post_url);
            return <article key={item.publication_id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
                <span>{item.display_name}</span><span>·</span><span>{item.provider}</span><span>·</span>
                <span>Attempt {item.attempt_number} / {item.attempts}</span><span>·</span><span>{item.outcome}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{item.content_text}</p>
              <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                <p>Provider request: <span className="font-mono">{item.provider_request_id || 'Not returned'}</span></p>
                <p>Error: <span className="font-mono">{item.attempt_error_code || item.outbox_error_code || 'Unknown'}</span></p>
              </div>
              {item.attempt_error_message && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{item.attempt_error_message}</p>}
              {item.provider_response && Object.keys(item.provider_response).length > 0 &&
                <p className="break-all text-[10px] text-slate-500">Sanitized provider response: {JSON.stringify(item.provider_response)}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-bold text-slate-600">Verified provider post ID
                  <input value={draft.providerPostId || item.attempt_provider_post_id || item.publication_provider_post_id || ''} onChange={event => updateReconciliationDraft(item.publication_id, { providerPostId: event.target.value })} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal" placeholder="Required only if the post exists" />
                </label>
                <label className="block text-xs font-bold text-slate-600">Verified provider post URL
                  <input value={draft.providerPostUrl || item.provider_post_url || ''} onChange={event => updateReconciliationDraft(item.publication_id, { providerPostUrl: event.target.value })} maxLength={2048} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal" placeholder="https://…" />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-600">Operator evidence / verification note
                <textarea value={draft.evidence} onChange={event => updateReconciliationDraft(item.publication_id, { evidence: event.target.value })} minLength={10} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal" placeholder="Describe the provider account, request ID or post search used to verify the outcome. Do not paste credentials." />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={draft.confirmed} onChange={event => updateReconciliationDraft(item.publication_id, { confirmed: event.target.checked })} className="mt-0.5" />
                I checked the provider account and verified the outcome before changing this delivery.
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending || !draft.confirmed || draft.evidence.trim().length < 10 || !(draft.providerPostId || item.attempt_provider_post_id || item.publication_provider_post_id) || !(draft.providerPostUrl || item.provider_post_url)} onClick={() => reconcileDelivery(item, 'confirmed_published')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Confirm published · no retry</button>
                {!hasProviderReceipt && <button type="button" disabled={pending || !draft.confirmed || draft.evidence.trim().length < 10 || Number(item.attempts) >= 6} onClick={() => reconcileDelivery(item, 'confirmed_not_published')} className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-40">Confirm no post · requeue</button>}
                {Number(item.attempts) >= 6 && !hasProviderReceipt && <span className="self-center text-[11px] text-amber-800">Retry limit reached; resolve this item before creating a new publication.</span>}
              </div>
            </article>;
          })}
        </div>
      </section>}

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
