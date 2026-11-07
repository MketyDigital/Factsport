import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/app/lib/supabase/server';
import { env } from 'cloudflare:workers';
import { getPublicPredictionAffiliateSettings } from '@/lib/adapters/postgres-prediction-settings';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Prediction-only settings endpoint; never serve this projection on the public Media host. */
export async function GET() {
  const privateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  if (!privateHost || privateHost.includes('://') || privateHost.includes('/')) {
    return NextResponse.json({ error: 'Private Prediction host is not configured.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  if (requestHost !== privateHost) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const predictionBackend = env.FACTSPORT_PREDICTION_SETTINGS_BACKEND ?? process.env.FACTSPORT_PREDICTION_SETTINGS_BACKEND;
    if (predictionBackend === 'postgres') {
      const settings = await getPublicPredictionAffiliateSettings();
      return NextResponse.json({
        link1x: settings?.link_1xbet ?? null,
        linkMel: settings?.link_melbet ?? null,
        code1x: settings?.code_1xbet ?? null,
        codeMel: settings?.code_melbet ?? null,
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    if (env.FACTSPORT_ENVIRONMENT !== 'development') {
      return NextResponse.json({ error: 'V2 Prediction settings are not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = createClient();
    const { data } = await supabase.from('site_settings')
      .select('code_1xbet, code_melbet, link_1xbet, link_melbet')
      .eq('id', 1).single();
    return NextResponse.json({
      link1x: data?.link_1xbet || null,
      linkMel: data?.link_melbet || null,
      code1x: data?.code_1xbet || null,
      codeMel: data?.code_melbet || null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch private Prediction settings' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
