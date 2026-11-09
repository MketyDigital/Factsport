export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { headers } from 'next/headers';
import { isEntraExternalConfigured, isEntraMediaRequestHost } from '@/lib/auth/entra-external';
import { isFactsportEditorialPostgresReady } from '@/lib/adapters/postgres-client';
import { rejectPrivateProductHost } from '@/app/lib/private-product-host';

export default async function MediaLoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  await rejectPrivateProductHost();
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0].trim();
  const protocol = (requestHeaders.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  let isConfiguredMediaHost = false;
  try { isConfiguredMediaHost = !!host && isEntraMediaRequestHost(new URL(protocol + '://' + host)); } catch { isConfiguredMediaHost = false; }
  const hasError = Boolean(searchParams?.error);
  const signInReady = isEntraExternalConfigured() && isFactsportEditorialPostgresReady() && isConfiguredMediaHost;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 text-slate-950 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Factsport Media</p>
      <h1 className="mt-3 text-3xl font-black">Editor sign in</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Sign in with your authorized Factsport editorial identity. Access is assigned through Factsport Media roles.</p>
      {hasError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Sign-in could not be completed. Check your account assignment or contact the Media administrator.</p>}
      {signInReady
        ? <a href="/api/auth/entra/start?returnTo=%2Fadmin" className="mt-7 block rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800">Continue with Microsoft</a>
        : <div role="status" className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Media sign-in is not provisioned yet. The Entra external tenant/app registration, HTTPS callback, session secret and dedicated editorial database connection must all be configured before sign-in is enabled. No legacy email allowlist fallback is available.
          </div>}
      <Link href="/" className="mt-5 block text-center text-xs font-semibold text-slate-500 hover:text-slate-900">Return to Factsport</Link>
    </section>
  </main>;
}