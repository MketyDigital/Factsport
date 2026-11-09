'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  archiveEditorialArticle, approveEditorialRevision, rejectEditorialRevision, publishApprovedEditorial, restoreEditorialRevision, saveEditorialDraft,
  submitEditorialForReview,
} from './actions';
import { removeRevisionMedia, reviewRightsAndAttachMedia } from './media-actions';
import MarkdownRenderer from '@/app/components/MarkdownRenderer';
import NewsArtwork from '@/app/components/NewsArtwork';

type ReusableMediaAsset = {
  id: string; object_key: string; rights_status: string; rights_reference: string | null;
  attribution_text: string | null; alt_text: string | null; usage_expires_at: string | null;
};

type RevisionRecord = {
  id: string; revision_number: number; workflow_status: string; change_note: string | null;
  review_comment: string | null; created_at: string; snapshot: Record<string, any>;
};

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string;
  category: string;
  team_1_name: string | null;
  team_2_name: string | null;
  tags: string[];
  status: string;
  review_status: string;
  revision_status: string | null;
  review_comment?: string | null;
  is_headline: boolean;
  is_breaking: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  author_display_name: string;
  updated_at: string;
  revision_media?: Array<{ placement: 'hero' | 'team_1' | 'team_2' | 'inline'; position: number; remove_media: boolean; media_id: string | null; object_key: string | null; content_type: string | null; rights_status: string | null; alt_text: string | null; attribution_text: string | null }>;
};

const blank = {
  id: undefined as string | undefined,
  title: '', slug: '', excerpt: '', bodyMarkdown: '', category: 'Football', team1Name: '', team2Name: '',
  tagsText: '', seoTitle: '', seoDescription: '', canonicalUrl: '',
  authorDisplayName: 'FactSport Desk', isHeadline: false, isBreaking: false,
};

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewsroomClient({ initialArticles }: { initialArticles: Article[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyArticleId, setHistoryArticleId] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<RevisionRecord[]>([]);
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(null);
  const [historyPending, setHistoryPending] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [publicPolicyConfirmed, setPublicPolicyConfirmed] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [mediaPending, startMediaTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<{ id: string; object_key: string; rights_status: string; source?: 'upload' | 'library' } | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [existingAssets, setExistingAssets] = useState<ReusableMediaAsset[]>([]);
  const [libraryPending, setLibraryPending] = useState(false);
  const [assetAltText, setAssetAltText] = useState('');
  const [rightsStatus, setRightsStatus] = useState<'owned' | 'licensed' | 'editorial_exception'>('owned');
  const [rightsReference, setRightsReference] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [usageExpiresAt, setUsageExpiresAt] = useState('');
  const [placement, setPlacement] = useState<'hero' | 'team_1' | 'team_2' | 'inline'>('hero');
  const [mediaPosition, setMediaPosition] = useState(0);

  const currentRevisionMedia = articles.find(article => article.id === form.id)?.revision_media || [];
  const activeRevisionMedia = currentRevisionMedia.filter(asset => !asset.remove_media && asset.media_id);
  const previewHero = activeRevisionMedia.find(asset => asset.placement === 'hero');
  const previewTeam1 = activeRevisionMedia.find(asset => asset.placement === 'team_1');
  const previewTeam2 = activeRevisionMedia.find(asset => asset.placement === 'team_2');
  const previewInline = activeRevisionMedia.filter(asset => asset.placement === 'inline').sort((a, b) => a.position - b.position);

  const filtered = useMemo(() => articles.filter(article => {
    const matchesSearch = !search || article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.slug.includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || article.status === statusFilter);
  }), [articles, search, statusFilter]);

  async function openRevisionHistory(articleId: string) {
    setHistoryArticleId(articleId); setHistoryRecords([]); setHistorySelectedId(null); setHistoryPending(true);
    try {
      const response = await fetch('/api/admin/news/' + encodeURIComponent(articleId) + '/revisions', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Revision history unavailable.');
      setHistoryRecords(data.revisions || []);
      if (data.revisions?.[0]) setHistorySelectedId(data.revisions[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load revision history.');
      setHistoryArticleId(null);
    } finally { setHistoryPending(false); }
  }

  function restoreRevision(articleId: string, revisionId: string) {
    startTransition(async () => {
      const result = await restoreEditorialRevision(articleId, revisionId);
      setMessage(result.success ? 'Revision restored as a new draft. The live published article has not been changed.' : result.error || 'Revision restore failed.');
      if (result.success) window.location.reload();
    });
  }

  function edit(article: Article) {
    setPublicPolicyConfirmed(current => ({ ...current, [article.id]: false }));
    setForm({
      id: article.id, title: article.title, slug: article.slug, excerpt: article.excerpt || '',
      bodyMarkdown: article.body_markdown, category: article.category, team1Name: article.team_1_name || '', team2Name: article.team_2_name || '', tagsText: (article.tags || []).join(', '),
      seoTitle: article.seo_title || '', seoDescription: article.seo_description || '',
      canonicalUrl: article.canonical_url || '', authorDisplayName: article.author_display_name || 'FactSport Desk',
      isHeadline: article.is_headline, isBreaking: article.is_breaking,
    });
    setMessage('');
    setPreviewOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function findReusableAssets() {
    setLibraryPending(true);
    try {
      const params = new URLSearchParams({ q: assetSearch, status: 'all', offset: '0' });
      const response = await fetch('/api/admin/media?' + params.toString(), { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to search media library.');
      const now = Date.now();
      setExistingAssets((data.assets || []).filter((asset: ReusableMediaAsset) =>
        ['owned', 'licensed', 'editorial_exception'].includes(asset.rights_status) &&
        (!asset.usage_expires_at || new Date(asset.usage_expires_at).valueOf() > now)
      ));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Media library search failed.');
      setExistingAssets([]);
    } finally { setLibraryPending(false); }
  }

  function reset() {
    setForm(blank);
    setPreviewOpen(false);
    setMessage('');
  }

  function save() {
    startTransition(async () => {
      const result = await saveEditorialDraft({
        id: form.id, title: form.title, slug: form.slug || slugify(form.title),
        excerpt: form.excerpt, bodyMarkdown: form.bodyMarkdown, category: form.category,
        team1Name: form.team1Name, team2Name: form.team2Name, tags: form.tagsText.split(',').map(value => value.trim()).filter(Boolean),
        seoTitle: form.seoTitle, seoDescription: form.seoDescription,
        canonicalUrl: form.canonicalUrl, authorDisplayName: form.authorDisplayName,
        isHeadline: form.isHeadline, isBreaking: form.isBreaking,
      });
      if (!result.success) { setMessage(result.error); return; }
      if (!result.data) { setMessage('Draft save returned no article identifier.'); return; }
      const savedArticleId = result.data.id;
      setPublicPolicyConfirmed(current => ({ ...current, [savedArticleId]: false }));
      setMessage('Draft saved. Refreshing the newsroom to load its revision-scoped media state…');
      setForm(current => ({ ...current, id: savedArticleId }));
      window.location.reload();
    });
  }

  function runAction(action: (id: string) => Promise<{ success: boolean; error?: string }>, id: string, successMessage: string) {
    startTransition(async () => {
      const result = await action(id);
      setMessage(result.success ? successMessage + ' Refreshing list…' : result.error || 'Action failed.');
      if (result.success) window.location.reload();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Media system / Editorial</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Newsroom CMS</h1>
          <p className="mt-1 text-sm text-slate-500">Draft, review, publish and preserve editorial history.</p>
        </div>
        <button onClick={reset} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">New article</button>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">{form.id ? 'Edit article draft' : 'Create article'}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Media content</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2 text-xs font-bold text-slate-600">Headline
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} maxLength={240} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" />
            </label>
            <label className="text-xs font-bold text-slate-600">URL slug
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} maxLength={180} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Category
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Team 1 / home-side name
              <input value={form.team1Name} onChange={e => setForm({ ...form, team1Name: e.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Team 2 / away-side name
              <input value={form.team2Name} onChange={e => setForm({ ...form, team2Name: e.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-slate-800">Rights-aware media library</h3>
              <p className="mt-1 text-xs text-slate-500">Upload JPEG, PNG or WebP files to private R2 storage. Every image stays private until its rights are reviewed and it is attached to a draft.</p>
              {!form.id ? <p className="mt-3 text-sm font-semibold text-amber-800">Save the article draft first to attach media.</p> : <>
                {currentRevisionMedia.filter(asset => !asset.remove_media && asset.media_id).length > 0 && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">Attached to this draft revision</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {currentRevisionMedia.filter(asset => !asset.remove_media && asset.media_id).map(asset => <div key={asset.placement + ':' + asset.position} className="flex gap-3 rounded-lg border border-slate-100 p-2">
                      {asset.media_id && <img src={"/api/admin/media/" + encodeURIComponent(asset.media_id)} alt={asset.alt_text || "Private editorial media"} className="h-20 w-24 rounded-md border border-slate-200 object-contain" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{asset.placement === 'hero' ? 'Hero image' : asset.placement === 'team_1' ? 'Team 1 logo' : asset.placement === 'team_2' ? 'Team 2 logo' : 'Inline gallery · position ' + asset.position}</p>
                        <p className="mt-1 truncate text-[10px] text-slate-500">{asset.object_key || 'Media asset'}</p>
                        <p className="mt-1 text-[10px] text-emerald-700">{(asset.rights_status || 'pending').replace('_', ' ')}</p>
                        <button type="button" disabled={mediaPending} onClick={() => startMediaTransition(async () => {
                          const result = await removeRevisionMedia({ articleId: form.id!, placement: asset.placement, position: asset.position });
                          if (!result.success) { setMessage(result.error || 'Unable to remove attached media.'); return; }
                          setMessage('Media removal saved to this draft revision. Refreshing…');
                          window.location.reload();
                        })} className="mt-2 rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-700 disabled:opacity-50">Remove from draft</button>
                      </div>
                    </div>)}
                  </div>
                </div>}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Image file
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Image alt text
                    <input value={assetAltText} onChange={e => setAssetAltText(e.target.value)} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm" />
                  </label>
                </div>
                <button disabled={mediaPending || !selectedFile} onClick={() => startMediaTransition(async () => {
                  const data = new FormData();
                  data.append('file', selectedFile!);
                  data.append('altText', assetAltText);
                  const response = await fetch('/api/admin/media', { method: 'POST', body: data });
                  const json = await response.json();
                  if (!response.ok || !json.success) { setMessage(json.error || 'Image upload failed.'); return; }
                  setUploadedAsset({ ...json.asset, source: 'upload' });
                  setSelectedFile(null);
                  setMessage('Image uploaded privately. Complete the rights review before attaching it.');
                })} className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold disabled:opacity-50">
                  {mediaPending ? 'Uploading…' : 'Upload image'}
                </button>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-700">Reuse an existing approved asset</h4>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input value={assetSearch} onChange={event => setAssetSearch(event.target.value)} maxLength={100} placeholder="Search filename, alt text or attribution" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-xs" />
                    <button type="button" disabled={libraryPending} onClick={() => void findReusableAssets()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">{libraryPending ? 'Searching…' : 'Find approved assets'}</button>
                  </div>
                  {existingAssets.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {existingAssets.map(asset => <button type="button" key={asset.id} onClick={() => {
                      setUploadedAsset({ id: asset.id, object_key: asset.object_key, rights_status: asset.rights_status, source: 'library' });
                      setRightsStatus(asset.rights_status as typeof rightsStatus);
                      setRightsReference(asset.rights_reference || '');
                      setAttributionText(asset.attribution_text || '');
                      setAssetAltText(asset.alt_text || '');
                      setUsageExpiresAt(asset.usage_expires_at ? new Date(asset.usage_expires_at).toISOString().slice(0, 16) : '');
                      setMessage('Existing approved asset selected. Confirm its rights and attach it to this draft revision.');
                    }} className="rounded-lg border border-slate-200 p-3 text-left hover:border-blue-400">
                      <span className="block truncate text-xs font-bold text-slate-800">{asset.object_key}</span>
                      <span className="mt-1 block text-[10px] font-semibold uppercase text-emerald-700">{asset.rights_status.replace('_', ' ')}</span>
                      {asset.attribution_text && <span className="mt-1 block truncate text-[10px] text-slate-500">{asset.attribution_text}</span>}
                    </button>)}
                  </div>}
                  {existingAssets.length === 0 && <p className="mt-2 text-[11px] text-slate-500">Search to find reusable assets with approved rights and no expired usage window.</p>}
                </div>
                {uploadedAsset && <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-800">{uploadedAsset.source === 'library' ? 'Selected library asset: ' : 'Uploaded asset: '}{uploadedAsset.object_key}</p>
                  <img src={"/api/admin/media/" + encodeURIComponent(uploadedAsset.id)} alt={assetAltText || "Private editorial media preview"} className="mt-3 max-h-56 w-auto max-w-full rounded-lg border border-slate-200 object-contain" />
                  <p className="mt-1 text-xs text-amber-700">Private preview · Rights state: {uploadedAsset.rights_status.replace('_', ' ')}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">Placement
                      <select value={placement} onChange={e => setPlacement(e.target.value as typeof placement)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                        <option value="hero">Article hero image</option><option value="team_1">Team 1 logo</option><option value="team_2">Team 2 logo</option><option value="inline">Inline article gallery</option>
                      </select>
                    </label>
                    {placement === 'inline' && <label className="text-xs font-bold text-slate-600">Gallery order (0–100)
                      <input type="number" min={0} max={100} step={1} value={mediaPosition} onChange={event => setMediaPosition(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </label>}
                    <label className="text-xs font-bold text-slate-600">Rights status
                      <select value={rightsStatus} onChange={e => setRightsStatus(e.target.value as typeof rightsStatus)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                        <option value="owned">Owned by FactSport</option><option value="licensed">Licensed</option><option value="editorial_exception">Editorial exception</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-600 md:col-span-2">Rights reference (required for licensed / exception)
                      <input value={rightsReference} onChange={e => setRightsReference(e.target.value)} maxLength={2048} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">Attribution
                      <input value={attributionText} onChange={e => setAttributionText(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </label>
                    <label className="text-xs font-bold text-slate-600">Usage expires (optional)
                      <input type="datetime-local" value={usageExpiresAt} onChange={e => setUsageExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
                    </label>
                  </div>
                  <button disabled={mediaPending} onClick={() => startMediaTransition(async () => {
                    const result = await reviewRightsAndAttachMedia({
                      articleId: form.id!, assetId: uploadedAsset.id, placement, position: mediaPosition, rightsStatus,
                      rightsReference, attributionText, altText: assetAltText,
                      usageExpiresAt: usageExpiresAt ? new Date(usageExpiresAt).toISOString() : undefined,
                    });
                    if (!result.success) { setMessage(result.error || 'Media rights review failed.'); return; }
                    setUploadedAsset(null);
                    setMessage('Rights review recorded and media attached to the draft.');
                    window.location.reload();
                  })} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {mediaPending ? 'Reviewing…' : 'Approve rights & attach'}
                  </button>
                </div>}
              </>}
            </div>
            <label className="md:col-span-2 text-xs font-bold text-slate-600">Excerpt / social preview
              <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="md:col-span-2 text-xs font-bold text-slate-600">Article body (Markdown)
              <textarea value={form.bodyMarkdown} onChange={e => setForm({ ...form, bodyMarkdown: e.target.value })} rows={14} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" placeholder="Write the complete article. Use Markdown for headings, links and lists." />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Preview uses the same sanitized Markdown renderer as published articles.</p>
                <button type="button" onClick={() => setPreviewOpen(value => !value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  {previewOpen ? 'Hide article preview' : 'Preview article'}
                </button>
              </div>
              {previewOpen && <section aria-label="Article preview" className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative h-[42vh] min-h-[260px] max-h-[520px] overflow-hidden border-b-4 border-blue-600 bg-[#0a1428]">
                  <NewsArtwork
                    image={previewHero?.media_id ? '/api/admin/media/' + encodeURIComponent(previewHero.media_id) : null}
                    team1Logo={previewTeam1?.media_id ? '/api/admin/media/' + encodeURIComponent(previewTeam1.media_id) : null}
                    team2Logo={previewTeam2?.media_id ? '/api/admin/media/' + encodeURIComponent(previewTeam2.media_id) : null}
                    title={form.title}
                    className="h-full w-full opacity-70"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1428] via-[#0a1428]/70 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-8">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {form.isBreaking && <span className="rounded-md bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Breaking</span>}
                      <span className="rounded-md bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">{form.category || 'Football'}</span>
                      <span className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Draft preview</span>
                    </div>
                    <h2 className="max-w-4xl text-2xl font-black leading-tight text-white md:text-4xl">{form.title || 'Untitled article'}</h2>
                    {form.excerpt && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{form.excerpt}</p>}
                    <p className="mt-3 text-[11px] font-semibold text-slate-300">{form.authorDisplayName || 'FactSport Desk'} · Not published</p>
                  </div>
                </div>
                <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="prose prose-lg prose-slate max-w-none text-slate-800">
                      {form.bodyMarkdown.trim()
                        ? <MarkdownRenderer content={form.bodyMarkdown} />
                        : <p className="italic text-slate-500">Article body preview will appear here.</p>}
                    </div>
                    {previewInline.length > 0 && <section className="mt-10 border-t border-slate-200 pt-7" aria-label="Preview media gallery">
                      <h3 className="mb-4 text-lg font-black text-slate-900">More from this story</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {previewInline.map(asset => <figure key={asset.placement + ':' + asset.position} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={'/api/admin/media/' + encodeURIComponent(asset.media_id!)} alt={asset.alt_text || 'Editorial image'} width={asset.width || undefined} height={asset.height || undefined} className="h-auto max-h-[420px] w-full object-contain" loading="lazy" decoding="async" />
                          {asset.attribution_text && <figcaption className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">{asset.attribution_text}</figcaption>}
                        </figure>)}
                      </div>
                    </section>}
                  </div>
                  <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Media placement preview</p>
                    <p className="mt-2 text-xs text-slate-700">Hero: {previewHero ? 'Attached' : 'No image'}</p>
                    <p className="mt-1 text-xs text-slate-700">Team marks: {previewTeam1 || previewTeam2 ? 'Attached' : 'None'}</p>
                    <p className="mt-1 text-xs text-slate-700">Inline gallery: {previewInline.length} image(s)</p>
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">Private preview only. The public article layout may include live match context and approved site modules; no advertising is shown in this editor preview.</p>
                  </aside>
                </div>
              </section>}
            </label>
            <label className="text-xs font-bold text-slate-600">Tags (comma separated)
              <input value={form.tagsText} onChange={e => setForm({ ...form, tagsText: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Author display name
              <input value={form.authorDisplayName} onChange={e => setForm({ ...form, authorDisplayName: e.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">SEO title
              <input value={form.seoTitle} onChange={e => setForm({ ...form, seoTitle: e.target.value })} maxLength={240} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">Canonical URL
              <input value={form.canonicalUrl} onChange={e => setForm({ ...form, canonicalUrl: e.target.value })} maxLength={2048} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
            <label className="md:col-span-2 text-xs font-bold text-slate-600">SEO description
              <textarea value={form.seoDescription} onChange={e => setForm({ ...form, seoDescription: e.target.value })} maxLength={320} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            </label>
          </div>
          <div className="my-4 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isHeadline} onChange={e => setForm({ ...form, isHeadline: e.target.checked })} /> Homepage headline</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isBreaking} onChange={e => setForm({ ...form, isBreaking: e.target.checked })} /> Breaking news</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={isPending} onClick={save} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{isPending ? 'Saving…' : 'Save draft'}</button>
            {form.id && <button disabled={isPending} onClick={() => runAction(submitEditorialForReview, form.id!, 'Submitted for review.')} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-800">Submit for review</button>}
            <button onClick={reset} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">Clear</button>
          </div>
          {message && <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-black text-amber-950">Publishing safeguards</h3>
            <label className="mt-3 block text-xs font-bold text-amber-900">Review feedback / publisher note
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} maxLength={2000} rows={3} placeholder="Explain requested changes or leave a note for the audit trail…" className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-2 text-sm font-normal text-slate-800" />
            </label>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-amber-900">
              <li>Saving always creates or updates a draft.</li>
              <li>Publishing requires a separate review approval.</li>
              <li>The author cannot approve their own article.</li>
              <li>Every save creates a revision snapshot.</li>
              <li>Images require rights-reviewed media assets before public use.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-black">Workflow</h3>
            <ol className="mt-3 space-y-3 text-sm text-slate-600">
              <li><b>1. Draft</b><br/>Write and save the article.</li>
              <li><b>2. Review</b><br/>Submit the draft for editorial review.</li>
              <li><b>3. Approve</b><br/>A different editor approves the submitted revision.</li><li><b>4. Publish</b><br/>A separate publisher releases the approved revision.</li>
            </ol>
          </div>
        </aside>
      </section>

      {historyArticleId && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-700">Editorial audit trail</p><h2 className="mt-1 text-lg font-black">Revision history</h2></div>
          <button type="button" onClick={() => { setHistoryArticleId(null); setHistoryRecords([]); setHistorySelectedId(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Close history</button>
        </div>
        {historyPending && <p className="mt-4 text-sm text-slate-500">Loading revisions…</p>}
        {!historyPending && historyRecords.length === 0 && <p className="mt-4 text-sm text-slate-500">No revision records found.</p>}
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-2">
            {historyRecords.map(revision => <div key={revision.id} className={historySelectedId === revision.id ? 'rounded-xl border border-blue-300 bg-blue-50 p-3' : 'rounded-xl border border-slate-200 p-3'}>
              <button type="button" onClick={() => setHistorySelectedId(revision.id)} className="w-full text-left">
                <span className="flex items-center justify-between gap-2 text-xs font-black text-slate-800"><span>Revision {revision.revision_number}</span><span className="uppercase text-slate-500">{revision.workflow_status.replace('_', ' ')}</span></span>
                <span className="mt-1 block text-[11px] text-slate-500">{new Date(revision.created_at).toLocaleString()}</span>
                {revision.change_note && <span className="mt-1 block text-[11px] text-slate-600">{revision.change_note}</span>}
                {revision.review_comment && <span className="mt-1 block text-[11px] text-amber-800">Review: {revision.review_comment}</span>}
              </button>
              <button type="button" disabled={isPending} onClick={() => restoreRevision(historyArticleId, revision.id)} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">Restore as new draft</button>
            </div>)}
          </div>
          {(() => {
            const selected = historyRecords.find(item => item.id === historySelectedId);
            const current = articles.find(item => item.id === historyArticleId);
            if (!selected) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Choose a revision to compare its saved snapshot.</p>;
            return <div className="grid gap-3 xl:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-slate-200 p-3"><h3 className="mb-2 text-xs font-black uppercase text-slate-600">Current newsroom version</h3><p className="font-bold text-slate-900">{current?.title || 'Current article'}</p><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{current?.body_markdown || ''}</pre></div>
              <div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/40 p-3"><h3 className="mb-2 text-xs font-black uppercase text-blue-800">Selected revision {selected.revision_number}</h3><p className="font-bold text-slate-900">{String(selected.snapshot.title || '')}</p><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{String(selected.snapshot.body_markdown || '')}</pre></div>
            </div>;
          })()}
        </div>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search headline or slug…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All statuses</option><option value="draft">Drafts</option><option value="in_review">In review</option><option value="published">Published</option><option value="archived">Archived</option>
          </select>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map(article => (
            <article key={article.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span>{article.category}</span><span>·</span><span>{article.status.replace('_', ' ')}</span>{article.revision_status && <span>· revision {article.revision_status.replace('_', ' ')}</span>}
                  {article.review_status && <span>· {article.review_status}</span>}
                  {article.is_breaking && <span className="text-red-600">Breaking</span>}
                  {article.is_headline && <span className="text-blue-700">Headline</span>}
                </div>
                <h3 className="truncate font-bold text-slate-900">{article.title}</h3>{article.revision_status === 'rejected' && article.review_comment && <p className="mt-1 text-xs text-amber-800">Review feedback: {article.review_comment}</p>}
                <p className="mt-1 truncate text-xs text-slate-500">/{article.slug} · Updated {new Date(article.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={() => edit(article)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Edit</button>
                <button onClick={() => void openRevisionHistory(article.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">History</button>
                {article.revision_status === 'in_review' && <button disabled={isPending} onClick={() => runAction(approveEditorialRevision, article.id, 'Revision approved. A separate publisher must publish it.')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Approve revision</button>}{article.revision_status === 'approved' && <div className="min-w-[230px] space-y-2">
                  <label className="flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                    <input type="checkbox" checked={!!publicPolicyConfirmed[article.id]} onChange={e => setPublicPolicyConfirmed(current => ({ ...current, [article.id]: e.target.checked }))} className="mt-0.5" />
                    <span>I confirm this revision is appropriate for public Media: no bookmaker/affiliate links, betting promotions, bonus codes, wagering CTAs or private Prediction offers.</span>
                  </label>
                  <button disabled={isPending || !publicPolicyConfirmed[article.id]} onClick={() => runAction(id => publishApprovedEditorial(id, true), article.id, 'Approved revision published.')} className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Publish approved</button>
                </div>}
                {article.status !== 'archived' && <button disabled={isPending} onClick={() => runAction(archiveEditorialArticle, article.id, 'Article archived.')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Archive</button>}
              </div>
            </article>
          ))}
          {filtered.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No articles match this filter.</p>}
        </div>
      </section>
    </div>
  );
}
