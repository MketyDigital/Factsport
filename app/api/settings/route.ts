import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { getPublicHomepageSettings } from '@/lib/adapters/postgres-homepage';

export const runtime = 'edge';
export const revalidate = 300;

export async function GET() {
  try {
    if (process.env.FACTSPORT_HOMEPAGE_BACKEND === 'postgres') {
      const settings = await getPublicHomepageSettings();
      return NextResponse.json({
        link1x: null,
        linkMel: null,
        code1x: null,
        codeMel: null,
        featured_match_id: settings?.featured_match_id ? String(settings.featured_match_id) : null,
      }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' } });
    }

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
