'use client';

import { useState, useTransition } from 'react';
import { removeEditorialVideoFromRevision, reviewRightsAndAttachVideo } from './media-actions';

type AttachedVideo = {
  position: number; video_id: string | null; remove_video: boolean;
  title: string | null; upload_status: string | null; rights_status: string | null;
  rights_reference: string | null; attribution_text: string | null;
  usage_expires_at: string | null; duration_seconds: number | null;
};
type AvailableVideo = {
  id: string; title: string; upload_status: string; duration_seconds: number | null;
  rights_status: string; rights_reviewed_at: string | null;
};

export default function EditorialVideoAttachments({ articleId, revisionStatus, attachments }: {
  articleId?: string; revisionStatus: string | null; attachments: AttachedVideo[];
}) {
  const [videos, setVideos] = useState<AvailableVideo[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [position, setPosition] = useState(0);
  const [rightsStatus, setRightsStatus] = useState<'owned' | 'licensed' | 'editorial_exception'>('owned');
  const [rightsReference, setRightsReference] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [usageExpiresAt, setUsageExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function loadVideos() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/media/videos', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Video library unavailable.');
      const ready = (data.videos || []).filter((video: AvailableVideo) => video.upload_status === 'ready');
      setVideos(ready);
      if (!selectedId && ready[0]) setSelectedId(ready[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video library unavailable.');
    } finally { setLoading(false); }
  }

  const canEdit = Boolean(articleId) && revisionStatus === 'draft';
  const active = attachments.filter(item => item.video_id && !item.remove_video);

  return <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-black text-slate-800">Editorial video clips</h3>
    <p className="mt-1 text-xs text-slate-500">Attach only processed clips with reviewed usage rights. Video uploads are stored in Cloudflare Stream, separately from R2 images and StreamIO live broadcasts.</p>
    {!articleId && <p className="mt-3 text-xs text-amber-700">Save the article draft before attaching video.</p>}
    {articleId && revisionStatus !== 'draft' && <p className="mt-3 text-xs text-amber-700">Video attachments are locked while this revision is in review or approved.</p>}
    <div className="mt-3 space-y-2">
      {attachments.map(item => <div key={item.position} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div>
          <p className="text-xs font-bold text-slate-800">{item.remove_video ? 'Video scheduled for removal' : item.title || 'Video asset'}</p>
          <p className="text-[10px] text-slate-500">Position {item.position} · {item.upload_status || 'unknown'} · {item.rights_status || 'rights pending'}</p>
        </div>
        {canEdit && !item.remove_video && <button type="button" disabled={pending} onClick={() => startTransition(async () => {
          const result = await removeEditorialVideoFromRevision({ articleId: articleId!, position: item.position });
          if (!result.success) { setMessage(result.error || 'Unable to remove video.'); return; }
          window.location.reload();
        })} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-bold text-rose-700">Remove from draft</button>}
      </div>)}
      {!attachments.length && <p className="text-[11px] text-slate-400">No video clips attached to this revision.</p>}
    </div>
    {canEdit && <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-700">Attach a processed video</h4>
        <button type="button" onClick={() => void loadVideos()} disabled={loading} className="text-[11px] font-bold text-blue-700 underline">{loading ? 'Loading…' : 'Load ready videos'}</button>
      </div>
      {videos.length > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-[11px] font-bold text-slate-600">Video asset
          <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs">
            {videos.map(video => <option key={video.id} value={video.id}>{video.title} · {video.rights_status}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-600">Display position
          <input type="number" min={0} max={100} value={position} onChange={event => setPosition(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-slate-600">Rights status
          <select value={rightsStatus} onChange={event => setRightsStatus(event.target.value as typeof rightsStatus)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs">
            <option value="owned">Owned</option><option value="licensed">Licensed</option><option value="editorial_exception">Editorial exception</option>
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-600">Rights / licence reference
          <input value={rightsReference} onChange={event => setRightsReference(event.target.value)} maxLength={2048} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-slate-600">Attribution
          <input value={attributionText} onChange={event => setAttributionText(event.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-slate-600">Usage expiry (optional)
          <input type="datetime-local" value={usageExpiresAt} onChange={event => setUsageExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
        </label>
        <div className="md:col-span-2">
          <button type="button" disabled={pending || !selectedId || position < 0 || position > 100 || (rightsStatus !== 'owned' && !rightsReference.trim())} onClick={() => startTransition(async () => {
            const result = await reviewRightsAndAttachVideo({
              articleId: articleId!, videoId: selectedId, position, rightsStatus,
              rightsReference, attributionText, usageExpiresAt,
            });
            if (!result.success) { setMessage(result.error || 'Unable to attach video.'); return; }
            window.location.reload();
          })} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Review rights &amp; attach video</button>
        </div>
      </div>}
    </div>}
    {message && <p role="status" className="mt-3 text-xs text-rose-700">{message}</p>}
  </section>;
}
