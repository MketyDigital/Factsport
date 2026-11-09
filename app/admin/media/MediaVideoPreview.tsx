'use client';

import { useState } from 'react';

export default function MediaVideoPreview({ videoId, title }: { videoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function showPreview() {
    if (iframeUrl) { setOpen(value => !value); return; }
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/admin/media/videos/' + encodeURIComponent(videoId) + '/preview', {
        credentials: 'same-origin', cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success || typeof data.iframeUrl !== 'string') throw new Error(data.error || 'Preview unavailable.');
      setIframeUrl(data.iframeUrl); setOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview unavailable.');
    } finally { setLoading(false); }
  }

  return <div className="mt-2">
    <button type="button" onClick={() => void showPreview()} disabled={loading} className="text-[10px] font-bold text-blue-700 underline">{loading ? 'Preparing preview…' : open ? 'Hide private preview' : 'Preview private clip'}</button>
    {open && iframeUrl && <iframe src={iframeUrl} title={'Private preview: ' + title} className="mt-2 aspect-video w-full rounded-lg bg-black" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />}
    {message && <p role="status" className="mt-1 text-[10px] text-rose-700">{message}</p>}
  </div>;
}
