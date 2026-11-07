import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { env } from 'cloudflare:workers';
import { getPublicHomepageSettings } from '@/lib/adapters/postgres-homepage';
import { getPublicPredictionAffiliateSettings } from '@/lib/adapters/postgres-prediction-settings';

export const runtime = 'edge';
export const revalidate = 300;

export async function GET() {
  try {
    const mediaBackend = env.FACTSPORT_HOMEPAGE_BACKEND ?? process.env.FACTSPORT_HOMEPAGE_BACKEND;
    const predictionBackend = env.FACTSPORT_PREDICTION_SETTINGS_BACKEND ?? process.env.FACTSPORT_PREDICTION_SETTINGS_BACKEND;
    if (mediaBackend === 'postgres' && predictionBackend === 'postgres') {
      const [mediaSettings, predictionSettings] = await Promise.all([
        getPublicHomepageSettings(),
        getPublicPredictionAffiliateSettings(),
      ]);
      return NextResponse.json({
        link1x: predictionSettings?.link_1xbet ?? null,
        linkMel: predictionSettings?.link_melbet ?? null,
        code1x: predictionSettings?.code_1xbet ?? null,
        codeMel: predictionSettings?.code_melbet ?? null,
        featured_match_id: mediaSettings?.featured_match_id ? String(mediaSettings.featured_match_id) : null,
      }, { headers: { 'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging' ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } });
    }
    if (env.FACTSPORT_ENVIRONMENT !== 'development') {
      return NextResponse.json({ error: 'V2 public settings projections are not fully provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    // Local development compatibility only. Production V2 must use separate Media
    // and Prediction projections; this fallback is never allowed in staging/production.
    const supabase = createClient();
    const { data: settings } = await supabase
      .from('site_settings')
      .select('code_1xbet, code_melbet, link_1xbet, link_melbet, featured_match_id:social_config->>featured_match_id')
      .eq('id', 1)
      .single();

    let code1x = settings?.code_1xbet;
    if (!code1x) {
      const { data: latestMatch } = await supabase
        .from('matches')
        .select('booking_code')
        .not('booking_code', 'is', null)
        .neq('booking_code', '')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (latestMatch?.booking_code) code1x = latestMatch.booking_code;
    }

    return NextResponse.json({
      link1x: settings?.link_1xbet || null,
      linkMel: settings?.link_melbet || null,
      code1x: code1x || null,
      codeMel: settings?.code_melbet || null,
      featured_match_id: settings?.featured_match_id || null,
    }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch public settings' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
