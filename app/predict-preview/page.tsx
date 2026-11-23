import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import Link from 'next/link';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Predict Preview | FactSport',
  description: 'Staging-only preview of the Factsport free-prediction journey.',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function PredictPreviewPage() {
  const bindings = env as unknown as Record<string, unknown>;
  if (bindings.FACTSPORT_ENVIRONMENT !== 'staging') notFound();
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  if (!/^factsport-v2-staging\.[a-z0-9-]+\.workers\.dev$/i.test(requestHost)) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1428] px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-sm md:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-blue-300">FactSport Predict · staging preview</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Try free predictions</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">Choose an upcoming fixture, select the result and score, and enter email only when you submit. Submission controls appear when the dedicated Prediction API readiness flag is enabled. This preview is not available on the production Media host.</p>
        <Link href="/matches" className="group mt-8 flex min-h-16 items-center justify-between rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-blue-700/70 to-cyan-500/20 px-5 py-4 font-extrabold shadow-[0_12px_50px_rgba(0,180,255,.14)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
          Browse fixtures <span aria-hidden="true" className="text-2xl transition-transform duration-300 group-hover:translate-x-1">⚽</span>
        </Link>
      </section>
    </main>
  );
}
