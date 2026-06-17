// app/api/match-data/route.ts

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getExternalData } from '@/app/lib/matchService';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const referer = request.headers.get('referer') || '';
    const fetchSite = request.headers.get('sec-fetch-site') || '';
    const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';

    const authHeader = request.headers.get('Authorization') || '';
    const isVIP = authHeader === `Bearer ${process.env.CRON_KEY}`;

    if (!isBrowser && !isVIP) {
      return NextResponse.json({ error: 'Direct API access is protected.' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('id');

  if (!matchId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const supabase = createClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const freshData = await getExternalData(data);

  const currentStatus = String(data.status || '').toUpperCase();
  const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);
  const isLive = ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PENALTIES'].includes(currentStatus);

  let cacheSeconds = 60;
  if (isLive) cacheSeconds = 5;
  if (isFinished) cacheSeconds = 3600;

  return NextResponse.json(freshData, {
    headers: {
      'Cache-Control': `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=10`
    }
  });
}