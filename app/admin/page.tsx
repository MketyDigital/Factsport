export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Newspaper, Send, Radio } from 'lucide-react';

export default function MediaAdminHome() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Factsport / Media system</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Media operations</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Manage editorial content, distribution and live broadcast operations. Prediction campaigns, scoring, settlement, subscriptions and prize administration are not part of this workspace.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/news" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><Newspaper/><h2 className="mt-3 font-black">Newsroom</h2><p className="mt-1 text-sm text-slate-500">Draft, review and publish editorial revisions.</p></Link>
        <Link href="/admin/social" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><Send/><h2 className="mt-3 font-black">Social publishing</h2><p className="mt-1 text-sm text-slate-500">Schedule channel-specific posts and track delivery readiness.</p></Link>
        <Link href="/admin/studio" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"><Radio/><h2 className="mt-3 font-black">Live studio</h2><p className="mt-1 text-sm text-slate-500">Broadcast controls are gated until the V2 issuer is provisioned.</p></Link>
      </div>
    </section>
  );
}
