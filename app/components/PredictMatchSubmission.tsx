import { headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import PublicPredictionSubmit from '@/app/components/PublicPredictionSubmit';

/** Render free-play controls only on the configured Predict subdomain. */
export default async function PredictMatchSubmission(props: {
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  matchStatus: string;
}) {
  const rawConfiguredHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim();
  const bindings = env as unknown as Record<string, unknown>;
  const environment = typeof bindings.FACTSPORT_ENVIRONMENT === 'string' ? bindings.FACTSPORT_ENVIRONMENT : '';
  let configuredHost = '';
  try {
    configuredHost = new URL(rawConfiguredHost.includes('://') ? rawConfiguredHost : `https://${rawConfiguredHost}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (bindings.FACTSPORT_PREDICTION_SUBMISSION_READY !== 'true') return null;
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  const isProductionPredictHost = environment === 'production' && configuredHost === 'predict.factsport.com' && requestHost === configuredHost;
  const isStagingPreviewHost = environment === 'staging' && /^factsport-v2-staging\.[a-z0-9-]+\.workers\.dev$/i.test(requestHost);
  if (!isProductionPredictHost && !isStagingPreviewHost) return null;
  const status = props.matchStatus.toUpperCase();
  if (!['SCHEDULED', 'PRE_MATCH', 'NOT STARTED', 'NS'].includes(status)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(props.matchId)) return null;

  return (
    <section className="mx-2 my-4 overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-lg shadow-blue-950/5 sm:mx-0 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Free prediction</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Call the match</h2>
        </div>
        <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-2xl">⚽</span>
      </div>
      <PublicPredictionSubmit matchId={props.matchId} matchDate={props.matchDate} homeTeam={props.homeTeam} awayTeam={props.awayTeam} />
    </section>
  );
}
