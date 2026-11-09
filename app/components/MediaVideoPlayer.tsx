'use client';

import { useEffect, useState } from 'react';

export default function MediaVideoPlayer({ videoId, title }: { videoId: string; title: string }) {
  const [iframeUrl, setIframeUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/media/videos/' + encodeURIComponent(videoId) + '/playback', {
      credentials: 'same-origin', cache: 'no-store',
    }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success || typeof data.iframeUrl !== 'string') {
        throw new Error('Video playback unavailable.');
      }
      if (active) {
        setIframeUrl(data.iframeUrl);
        setThumbnailUrl(typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : '');
      }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [videoId]);

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
    {iframeUrl ? <iframe
      src={iframeUrl}
      title={title}
      className="aspect-video w-full"
      loading="lazy"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
    /> : error ? <div className="flex aspect-video items-center justify-center bg-slate-950 px-4 text-center text-xs text-slate-300">This video is temporarily unavailable.</div> : <div className="relative aspect-video animate-pulse bg-slate-900">
      {thumbnailUrl && <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">Preparing secure video playback…</div>
    </div>}
  </div>;
}
