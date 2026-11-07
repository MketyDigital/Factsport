'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  archiveEditorialArticle, approveEditorialRevision, rejectEditorialRevision, publishApprovedEditorial, saveEditorialDraft,
  submitEditorialForReview,
} from './actions';
import { reviewRightsAndAttachMedia } from './media-actions';

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
  const [reviewComment, setReviewComment] = useState('');
  const [isPending, startTransition] = useTransition();
  const [mediaPending, startMediaTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<{ id: string; object_key: string; rights_status: string } | null>(null);
  const [assetAltText, setAssetAltText] = useState('');
  const [rightsStatus, setRightsStatus] = useState<'owned' | 'licensed' | 'editorial_exception'>('owned');
  const [rightsReference, setRightsReference] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [usageExpiresAt, setUsageExpiresAt] = useState('');
  const [placement, setPlacement] = useState<'hero' | 'team_1' | 'team_2'>('hero');

  const filtered = useMemo(() => articles.filter(article => {
    const matchesSearch = !search || article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.slug.includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || article.status === statusFilter);
  }), [articles, search, statusFilter]);

  function edit(article: Article) {
    setForm({
      id: article.id, title: article.title, slug: article.slug, excerpt: article.excerpt || '',
      bodyMarkdown: article.body_markdown, category: article.category, team1Name: article.team_1_name || '', team2Name: article.team_2_name || '', tagsText: (article.tags || []).join(', '),
      seoTitle: article.seo_title || '', seoDescription: article.seo_description || '',
      canonicalUrl: article.canonical_url || '', authorDisplayName: article.author_display_name || 'FactSport Desk',
      isHeadline: article.is_headline, isBreaking: article.is_breaking,
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setForm(blank);
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
      setMessage('Draft saved. Reload the newsroom to see the updated record.');
      setForm(current => ({ ...current, id: savedArticleId }));
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
                  setUploadedAsset(json.asset);
                  setSelectedFile(null);
                  setMessage('Image uploaded privately. Complete the rights review before attaching it.');
                })} className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold disabled:opacity-50">
                  {mediaPending ? 'Uploading…' : 'Upload image'}
                </button>
                {uploadedAsset && <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
                  <p className="text-xs font-bold text-slate-800">Uploaded asset: {uploadedAsset.object_key}</p>
                  <p className="mt-1 text-xs text-amber-700">Rights state: pending review</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">Placement
                      <select value={placement} onChange={e => setPlacement(e.target.value as typeof placement)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                        <option value="hero">Article hero image</option><option value="team_1">Team 1 logo</option><option value="team_2">Team 2 logo</option>
                      </select>
                    </label>
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
                      articleId: form.id!, assetId: uploadedAsset.id, placement, rightsStatus,
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
                {article.revision_status === 'in_review' && <button disabled={isPending} onClick={() => runAction(approveEditorialRevision, article.id, 'Revision approved. A separate publisher must publish it.')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Approve revision</button>}{article.revision_status === 'approved' && <button disabled={isPending} onClick={() => runAction(publishApprovedEditorial, article.id, 'Approved revision published.')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Publish approved</button>}
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
