import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { env } from 'cloudflare:workers';
import { getPublicHomepageSettings } from '@/lib/adapters/postgres-homepage';

export const runtime = 'edge';
export const revalidate = 300;

/** Public Media settings only. Prediction affiliate settings are never returned here. */
export async function GET() {
  try {
    const mediaBackend = env.FACTSPORT_HOMEPAGE_BACKEND ?? process.env.FACTSPORT_HOMEPAGE_BACKEND;
    if (mediaBackend === 'postgres') {
      const mediaSettings = await getPublicHomepageSettings();
      return NextResponse.json({
        featured_match_id: mediaSettings?.featured_match_id ? String(mediaSettings.featured_match_id) : null,
        announcement_text: mediaSettings?.announcement_text ?? null,
        announcement_link: mediaSettings?.announcement_link ?? null,
        announcement_enabled: mediaSettings?.announcement_enabled === true,
      }, {
        headers: {
          'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging'
            ? 'private, no-store, max-age=0'
            : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }
    if (env.FACTSPORT_ENVIRONMENT !== 'development') {
      return NextResponse.json({ error: 'V2 public Media settings are not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    // Local development compatibility only. Do not expose legacy Prediction
    // affiliate links/codes through this public Media endpoint.
    const supabase = createClient();
    const { data: settings } = await supabase
      .from('site_settings')
      .select('announcement_text, announcement_link, announcement_enabled, featured_match_id:social_config->>featured_match_id')
      .eq('id', 1)
      .single();

    return NextResponse.json(
      { featured_match_id: settings?.featured_match_id || null, announcement_text: settings?.announcement_text || null, announcement_link: settings?.announcement_link || null, announcement_enabled: settings?.announcement_enabled === true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch public Media settings' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
