export const runtime = 'edge';
export const metadata = {
  title: 'About FactSport | Football News, Live Scores & Analysis',
  description: 'Learn about FactSport, an independent football and sports-media platform covering news, fixtures, live scores, match information and highlights.',
}

import Link from 'next/link';
import { ChevronLeft, Radio, Newspaper, Trophy } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F0F2F5] p-6 text-slate-800">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ChevronLeft size={16}/> Back to Home</Link>
        <div className="mb-8 border-b border-slate-100 pb-6">
          <img src="/logo.png" alt="FactSport" className="mb-5 h-10 w-auto"/>
          <h1 className="text-3xl font-black text-slate-900">About FactSport</h1>
          <p className="mt-3 text-lg text-slate-600">Football coverage, live match information and sports stories in one place.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <section className="rounded-xl border border-slate-200 p-5"><Newspaper className="text-blue-600"/><h2 className="mt-3 font-black">Sports journalism</h2><p className="mt-2 text-sm text-slate-600">News, features, match previews and analysis from football and the wider sports world.</p></section>
          <section className="rounded-xl border border-slate-200 p-5"><Radio className="text-red-600"/><h2 className="mt-3 font-black">Live match centre</h2><p className="mt-2 text-sm text-slate-600">Fixtures, results, live scores, match events, team information and highlights.</p></section>
          <section className="rounded-xl border border-slate-200 p-5"><Trophy className="text-amber-500"/><h2 className="mt-3 font-black">Football community</h2><p className="mt-2 text-sm text-slate-600">Public football features designed to help supporters follow competitions and discuss the game.</p></section>
        </div>
        <p className="mt-8 text-sm leading-7 text-slate-600">FactSport aims to make sports information accessible through a responsive web and media experience. Match information may be provided by third-party data partners and can be corrected or delayed. The public website is separate from private premium services, which have their own terms and access controls.</p>
      </article>
    </main>
  );
}
