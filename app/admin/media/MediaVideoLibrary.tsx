'use client';

import { useEffect, useState, useTransition } from 'react';
import MediaVideoRightsRevocationControl from './MediaVideoRightsRevocationControl';
import MediaVideoUsagePanel from './MediaVideoUsagePanel';
import MediaVideoPreview from './MediaVideoPreview';

type VideoAsset = {
  id: string; title: string; description: string | null; upload_status: string;
  upload_expires_at: string | null; duration_seconds: number | null;
  width: number | null; height: number | null; size_bytes: number | null;
  rights_status: string; rights_reviewed_at: string | null; is_public: boolean;
  created_at: string; updated_at: string;
};

export default function MediaVideoLibrary({ ready, schemaReady, canRevokeRights = false }: { ready: boolean; schemaReady: boolean; canRevokeRights?: boolean }) {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/media/videos', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Video library unavailable.');
      setVideos(data.videos || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Video library unavailable.');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (schemaReady) void load(); }, [schemaReady]);

  async function refresh(assetId: string) {
    const response = await fetch('/api/admin/media/videos/' + encodeURIComponent(assetId) + '/refresh', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Video status refresh failed.');
    await load();
    return data.asset as VideoAsset;
  }

  function upload() {
    if (!file || !title.trim()) return;
    startTransition(async () => {
      setMessage('');
      try {
        if (!file.type.startsWith('video/') || file.size > 200 * 1024 * 1024) {
          throw new Error('Choose a video file no larger than 200 MB. Larger uploads require the resumable TUS workflow.');
        }
        const created = await fetch('/api/admin/media/videos/direct-upload', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, maxDurationSeconds: 900 }),
        });
        const uploadData = await created.json();
        if (!created.ok || !uploadData.success) throw new Error(uploadData.error || 'Unable to start video upload.');
        const form = new FormData();
        form.append('file', file, file.name);
        const uploaded = await fetch(uploadData.upload.url, { method: 'POST', body: form });
        if (!uploaded.ok) throw new Error('Cloudflare Stream upload failed. The private upload record is retained for status reconciliation.');
        const status = await refresh(uploadData.asset.id);
        setMessage(status.upload_status === 'ready'
          ? 'Video uploaded and processed. Rights review and article attachment are still required before public playback.'
          : 'Video uploaded. Cloudflare Stream is still processing it; use Refresh status to check again.');
        setTitle(''); setDescription(''); setFile(null);
        const input = document.getElementById('factsport-video-file') as HTMLInputElement | null;
        if (input) input.value = '';
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Video upload failed.');
        await load();
      }
    });
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-black text-slate-900">Video &amp; clip library</h2>
        <p className="mt-1 text-xs text-slate-500">VOD clips use Cloudflare Stream, separate from R2 still images and StreamIO live rooms.</p>
      </div>
      <span className={ready ? 'rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600'}>{ready ? 'Provider configured' : 'Provider disabled'}</span>
    </div>
    {!schemaReady ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">The VOD schema is not activated in this environment. Apply migration 0041 and set FACTSPORT_MEDIA_VIDEO_SCHEMA_READY=true before enabling video assets.</p> : ready ? <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-bold text-slate-600">Video title
        <input value={title} onChange={event => setTitle(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
      </label>
      <label className="text-xs font-bold text-slate-600">Description
        <input value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
      </label>
      <label className="md:col-span-2 text-xs font-bold text-slate-600">Video file · up to 200 MB / 15 minutes
        <input id="factsport-video-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" onChange={event => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
      </label>
      <div className="md:col-span-2">
        <button type="button" onClick={upload} disabled={pending || !file || title.trim().length < 3} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{pending ? 'Uploading video…' : 'Create secure upload & send video'}</button>
      </div>
    </div> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Cloudflare Stream ingestion is fail-closed. It requires the account ID, Stream Write API token, signing-key ID and JWK, allowed playback origins, and FACTSPORT_STREAM_VIDEO_READY=true. No video is uploaded until those values are provisioned.</p>}
    {message && <p role="status" className="mt-3 text-xs text-slate-600">{message}</p>}
    <div className="mt-5 flex items-center justify-between">
      <h3 className="text-sm font-black text-slate-800">Recent video assets</h3>
      <button type="button" onClick={() => void load()} disabled={loading} className="text-xs font-bold text-blue-700 underline">{loading ? 'Refreshing…' : 'Refresh list'}</button>
    </div>
    <div className="mt-3 space-y-2">
      {videos.map(video => <div key={video.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{video.title}</p>
          <p className="mt-1 text-[10px] text-slate-500">{video.upload_status} · {video.rights_status} · {video.duration_seconds ? Math.round(video.duration_seconds) + ' sec' : 'duration pending'} · {video.width && video.height ? video.width + '×' + video.height : 'dimensions pending'}</p>
          {video.is_public && <p className="mt-1 text-[10px] font-bold text-emerald-700">Public on an approved article</p>}
          {schemaReady && <MediaVideoUsagePanel videoId={video.id} />}
          {ready && video.upload_status === 'ready' && <MediaVideoPreview videoId={video.id} title={video.title} />}
          {canRevokeRights && ['owned','licensed','editorial_exception'].includes(video.rights_status) && <MediaVideoRightsRevocationControl videoId={video.id} onRevoked={() => void load()} />}
        </div>
        <button type="button" disabled={pending} onClick={() => startTransition(async () => {
          try { const result = await refresh(video.id); setMessage(result.upload_status === 'ready' ? 'Video processing is complete; it still requires rights review and article publication.' : 'Video is still processing.'); }
          catch (error) { setMessage(error instanceof Error ? error.message : 'Refresh failed.'); }
        })} className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700 disabled:opacity-50">Refresh status</button>
      </div>)}
      {!videos.length && !loading && <p className="text-xs text-slate-400">No video assets have been added.</p>}
    </div>
  </section>;
}
