export const runtime = 'edge';
export const metadata = {
  title: 'Editorial Standards | FactSport',
  description: 'FactSport standards for original reporting, source attribution, corrections, media rights and editorial review.',
}

import Link from 'next/link';
import { ChevronLeft, BookOpenCheck } from 'lucide-react';

export default function EditorialStandardsPage() {
  return (
    <main className="min-h-screen bg-[#F0F2F5] p-6 text-slate-800">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ChevronLeft size={16}/> Back to Home</Link>
        <header className="mb-8 border-b border-slate-100 pb-6">
          <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900"><BookOpenCheck className="text-blue-600"/> Editorial Standards</h1>
          <p className="mt-2 text-sm text-slate-500">Public FactSport Media</p>
        </header>
        <div className="prose prose-slate max-w-none space-y-6">
          <section><h2>Accuracy and sourcing</h2><p>Sports reporting should be based on identifiable sources, including official club, league and competition communications, direct interviews and reputable reporting. Material facts should be checked against the best available source. Provider-supplied scores and statistics should be identified internally and corrected when reliable updates arrive.</p></section>
          <section><h2>Originality and attribution</h2><p>FactSport aims to publish original reporting, commentary and useful analysis. Third-party reporting, quotations, photographs, logos and video must not be copied wholesale or presented as FactSport-owned material. Use only material with a documented license, permission, public-domain basis or another verified legal basis, and include attribution where required.</p></section>
          <section><h2>AI-assisted content</h2><p>Automation or AI may assist research, formatting and drafting. It does not replace factual verification, source checks, rights review or accountable human editorial approval. Thin, repetitive or unverified automated articles should not be published.</p></section>
          <section><h2>Corrections and updates</h2><p>When a material error is confirmed, the article should be corrected promptly and the change recorded in the editorial history. Updates should not silently alter the meaning of a published report. Readers may raise a correction request through the official FactSport contact channels linked in the footer.</p></section>
          <section><h2>Editorial independence</h2><p>Commercial relationships, advertising and private product promotions must not determine editorial conclusions. Betting operator promotions are not part of the public Media experience.</p></section>
          <section><h2>Media rights and privacy</h2><p>Images, video, logos and embedded content require rights and privacy review before publication. Do not publish private, sensitive or unlawfully obtained personal information.</p></section>
          <section><h2>Review and accountability</h2><p>V2 editorial publishing is designed around separate writer, editor and publisher permissions, with revision history and an audit record. The production cutover remains subject to role provisioning, migration and workflow verification.</p></section>
        </div>
      </article>
    </main>
  );
}
