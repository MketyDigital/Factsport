export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';
import { getExternalData } from '@/app/lib/matchService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (process.env.NODE_ENV === 'production') {
    const referer = request.headers.get('referer') || '';
    const fetchSite = request.headers.get('sec-fetch-site') || '';
    const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
    const authHeader = request.headers.get('Authorization') || '';
    const isVIP = authHeader === `Bearer ${process.env.CRON_KEY}`;
    if (!isBrowser && !isVIP) {
      return NextResponse.json({ error: 'Direct ESPN Bridge Access is Restricted.' }, { status: 403 });
    }
  }

  if ((env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 match detail reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const dbData = await getPostgresMatchById(params.id);
    if (!dbData) return NextResponse.json({ error: 'Match not found' }, {
      status: 404, headers: { 'Cache-Control': 'no-store' },
    });
    const freshData = await getExternalData(dbData);
    const publicMediaData = { ...freshData };
    delete publicMediaData.predictor;
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json(publicMediaData, {
      headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=5, stale-while-revalidate=10' },
    });
  } catch {
    return NextResponse.json({ error: 'Match data temporarily unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
