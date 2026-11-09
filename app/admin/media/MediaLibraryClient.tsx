'use client';

import { useEffect, useState } from 'react';
import MediaDerivativeEditor from './MediaDerivativeEditor';
import MediaRightsRevocationControl from './MediaRightsRevocationControl';
import MediaUsagePanel from './MediaUsagePanel';
import MediaVideoLibrary from './MediaVideoLibrary';

type Asset = {
  id: string; object_key: string; content_type: string; byte_size: number;
  width: number | null; height: number | null; alt_text: string | null;
  rights_status: string; rights_reference: string | null; attribution_text: string | null;
  derived_from: string | null; variant_key: string | null;
  usage_expires_at: string | null; is_public: boolean; created_at: string;
};
type LibraryResponse = {
  success: boolean; assets: Asset[];
  page: { offset: number; limit: number; hasMore: boolean; nextOffset: number | null };
  error?: string;
};

const statuses = ['all', 'pending', 'owned', 'licensed', 'editorial_exception', 'rejected', 'expired'];

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function MediaLibraryClient({ canRevokeRights = false, derivativesReady = false, rightsRevocationReady = false, videoSchemaReady = false, streamVideoReady = false }: { canRevokeRights?: boolean; derivativesReady?: boolean; rightsRevocationReady?: boolean; videoSchemaReady?: boolean; streamVideoReady?: boolean }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [message, setMessage] = useState('Loading private media assets…');
  const [pending, setPending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [uploadPending, setUploadPending] = useState(false);

  async function load(offset = 0, append = false) {
    setPending(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ q: query, status, offset: String(offset) });
      const response = await fetch('/api/admin/media?' + params.toString(), {
        method: 'GET', cache: 'no-store', credentials: 'same-origin',
      });
      const data = await response.json() as LibraryResponse;
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load media assets.');
      setAssets(current => append ? [...current, ...data.assets] : data.assets);
      setNextOffset(data.page.nextOffset);
      setMessage(data.assets.length ? '' : 'No media assets match this search.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Media library unavailable.');
      if (!append) setAssets([]);
      setNextOffset(null);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => { void load(0, false); }, []);

  return <section className="space-y-6">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Media system / Assets</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Media library</h1>
      <p className="mt-2 text-sm text-slate-500">Private R2 assets, rights status, attribution and expiry. Public delivery remains restricted to assets approved and attached to published editorial content.</p>
    </header>

    <MediaVideoLibrary ready={streamVideoReady && videoSchemaReady} schemaReady={videoSchemaReady} canRevokeRights={canRevokeRights && rightsRevocationReady} />

    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_auto]" onSubmit={event => { event.preventDefault(); void load(0, false); }}>
      <label className="text-xs font-bold text-slate-600">Search assets
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="Filename, alt text or attribution" className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" />
      </label>
      <label className="text-xs font-bold text-slate-600">Rights status
        <select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal">
          {statuses.map(value => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replace('_', ' ')}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending} className="self-end rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Loading…' : 'Search library'}</button>
    </form>

    <form className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={async event => {
      event.preventDefault();
      if (!selectedFile) { setMessage('Choose a JPEG, PNG or WebP image first.'); return; }
      setUploadPending(true);
      setMessage('');
      try {
        const body = new FormData();
        body.append('file', selectedFile);
        body.append('altText', altText);
        const response = await fetch('/api/admin/media', {
          method: 'POST', body, credentials: 'same-origin', cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Media upload failed.');
        setSelectedFile(null);
        setAltText('');
        await load(0, false);
        setMessage('Image uploaded to private R2 storage. It remains unavailable publicly until rights are reviewed and it is attached to an approved published article.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Media upload failed.');
      } finally {
        setUploadPending(false);
      }
    }}>
      <label className="text-xs font-bold text-slate-700">Upload image (JPEG, PNG or WebP · max 8 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setSelectedFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs font-normal" />
      </label>
      <label className="text-xs font-bold text-slate-700">Alternative text
        <input value={altText} onChange={event => setAltText(event.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal" placeholder="Describe the image for accessibility" />
      </label>
      <button type="submit" disabled={uploadPending || !selectedFile} className="self-end rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{uploadPending ? 'Uploading…' : 'Upload privately'}</button>
    </form>

    {message && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{message}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map(asset => <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex h-48 items-center justify-center bg-slate-100">
          <img src={'/api/admin/media/' + encodeURIComponent(asset.id)} alt={asset.alt_text || 'Private editorial asset preview'} className="max-h-full max-w-full object-contain" loading="lazy" />
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-700">{asset.rights_status.replace('_', ' ')}</span>
            <span className="text-xs text-slate-500">{formatBytes(asset.byte_size)}</span>
          </div>
          <p className="break-all text-xs font-semibold text-slate-700">{asset.object_key}</p>
          <p className="text-xs text-slate-500">{asset.width && asset.height ? asset.width + ' × ' + asset.height + ' · ' : ''}{asset.content_type}</p>
          {asset.alt_text && <p className="text-sm text-slate-700">{asset.alt_text}</p>}
          {asset.attribution_text && <p className="text-xs text-slate-500">Attribution: {asset.attribution_text}</p>}
          {asset.rights_reference && <p className="break-words text-xs text-slate-500">Rights reference: {asset.rights_reference}</p>}
          {asset.usage_expires_at && <p className="text-xs text-amber-700">Usage expires: {new Date(asset.usage_expires_at).toLocaleString()}</p>}
          <p className="text-[11px] text-slate-400">{asset.is_public ? 'Eligible for public projection when attached to a published article' : 'Private / not publicly served'}</p>
          {asset.derived_from && <p className="text-[10px] text-indigo-700">Immutable derivative · {asset.variant_key?.replaceAll('_', ' ')} · source {asset.derived_from}</p>}
          {derivativesReady && <MediaUsagePanel assetId={asset.id} />}
          {['owned', 'licensed', 'editorial_exception'].includes(asset.rights_status) &&
            (!asset.usage_expires_at || new Date(asset.usage_expires_at).valueOf() > Date.now()) &&
            derivativesReady && <MediaDerivativeEditor asset={asset} onCreated={() => void load(0, false)} />}
          {canRevokeRights && rightsRevocationReady && ['owned', 'licensed', 'editorial_exception'].includes(asset.rights_status) && <MediaRightsRevocationControl assetId={asset.id} onRevoked={() => void load(0, false)} />}
        </div>
      </article>)}
    </div>
    {nextOffset !== null && <div className="text-center">
      <button disabled={pending} onClick={() => void load(nextOffset, true)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold disabled:opacity-50">{pending ? 'Loading…' : 'Load more assets'}</button>
    </div>}
  </section>;
}
