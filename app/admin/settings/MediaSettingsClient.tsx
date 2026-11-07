'use client';

import { useState, useTransition } from 'react';
import { saveMediaHomepageAnnouncement } from './actions';

export default function MediaSettingsClient({ initial }: { initial: { announcement_text: string | null; announcement_link: string | null; announcement_enabled: boolean } | null }) {
  const [announcementText, setAnnouncementText] = useState(initial?.announcement_text ?? '');
  const [announcementLink, setAnnouncementLink] = useState(initial?.announcement_link ?? '');
  const [enabled, setEnabled] = useState(initial?.announcement_enabled === true);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  function save() {
    setMessage('');
    startTransition(async () => {
      const result = await saveMediaHomepageAnnouncement({ text: announcementText, link: announcementLink, enabled });
      setMessage(result.success ? 'Media announcement saved.' : result.error);
    });
  }
  return <section className="mx-auto max-w-3xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Factsport / Media system</p><h1 className="mt-2 text-3xl font-black tracking-tight">Public homepage settings</h1><p className="mt-2 text-sm text-slate-600">Manage the public Media announcement only. Prediction affiliate links, promo codes, payment gateways and VIP settings are managed separately and are never exposed here.</p></header>
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Show announcement on public Media</label>
      <label className="block space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Announcement text</span><textarea value={announcementText} maxLength={280} onChange={event => setAnnouncementText(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Write a short public service or editorial announcement" /><span className="text-right text-xs text-slate-500">{announcementText.length}/280</span></label>
      <label className="block space-y-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">Optional public link</span><input type="url" value={announcementLink} onChange={event => setAnnouncementLink(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="https://factsport.com/news/..." /></label>
      <p className="text-xs leading-5 text-slate-500">Public announcements are screened for bookmaker and affiliate links, betting promotions and private Prediction offers before they can be enabled.</p>
      {message && <p role="status" className="text-sm font-semibold text-slate-700">{message}</p>}
      <button type="button" disabled={isPending} onClick={save} className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{isPending ? 'Saving…' : 'Save Media settings'}</button>
    </div>
  </section>;
}
