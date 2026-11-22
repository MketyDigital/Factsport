import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listPostgresLeagueMatches } from '@/lib/adapters/postgres-matches';

export const runtime = 'edge';
export const revalidate = 15;

const ALLOWED_LEAGUES = new Set([
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'Champions League', 'World Cup', 'Euros', 'Copa America', 'AFCON',
]);

export async function GET(request: Request) {
  const league = new URL(request.url).searchParams.get('league') || '';
  if (!ALLOWED_LEAGUES.has(league)) {
    return NextResponse.json({ error: 'Invalid league' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }
  if ((env.FACTSPORT_MATCHES_BACKEND ?? process.env.FACTSPORT_MATCHES_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 PostgreSQL competition reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const matches = await listPostgresLeagueMatches(league, 500);
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json(matches, {
      headers: {
        'Cache-Control': staging
          ? 'private, no-store, max-age=0'
          : 'public, max-age=0, s-maxage=10, stale-while-revalidate=5',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Competition matches temporarily unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
