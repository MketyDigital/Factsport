export const runtime = 'edge';
export const revalidate = 60;

import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listCurrentCompetitionStandings } from '@/lib/adapters/postgres-homepage';

const ALLOWED_LEAGUES = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1']);

export async function GET(request: Request) {
  const leagueCode = new URL(request.url).searchParams.get('league') || '';
  if (!ALLOWED_LEAGUES.has(leagueCode)) {
    return NextResponse.json({ error: 'Invalid league code' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }

  if ((env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 standings reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const data = await listCurrentCompetitionStandings(leagueCode);
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json(data, {
      headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch {
    return NextResponse.json({ error: 'Standings temporarily unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
