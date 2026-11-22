import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';

export const runtime = 'edge';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const referer = request.headers.get('referer') || '';
    const fetchSite = request.headers.get('sec-fetch-site') || '';
    const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
    const isVIP = request.headers.get('Authorization') === `Bearer ${process.env.CRON_KEY}`;
    if (!isBrowser && !isVIP) {
      return NextResponse.json({ error: 'Direct API access is protected.' }, { status: 403 });
    }
  }
  const matchId = new URL(request.url).searchParams.get('id');
  if (!matchId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  if ((env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 match detail reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const match = await getPostgresMatchById(matchId);
    if (!match) return NextResponse.json({ error: 'Match not found' }, {
      status: 404, headers: { 'Cache-Control': 'no-store' },
    });
    const currentStatus = String(match.status || '').toUpperCase();
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);
    const isLive = ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(currentStatus);
    const cacheSeconds = isFinished ? 3600 : isLive ? 5 : 60;
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json({
      id: match.id, status: match.status, home_score: match.home_score, away_score: match.away_score,
      displayClock: match.display_clock ?? null, widget_id: match.provider_widget_id ?? null,
      match_events: match.match_events ?? [], lineups: match.lineups ?? {}, stats: match.stats ?? {},
    }, { headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=10` } });
  } catch {
    return NextResponse.json({ error: 'Match data temporarily unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
