import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listCurrentCompetitionPlayerLeaders } from '@/lib/adapters/postgres-homepage';

export const runtime = 'edge';
export const revalidate = 300;

const LEAGUE_CODES = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1']);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const league = params.get('league') || 'PL';
  const stat = params.get('stat') || 'goals';

  if (!LEAGUE_CODES.has(league) || (stat !== 'goals' && stat !== 'assists')) {
    return NextResponse.json({ error: 'Invalid league or statistic' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const backend = env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND;
    if (backend !== 'postgres') {
      return NextResponse.json({ error: 'V2 player statistics reader is not provisioned.' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
    const rows = await listCurrentCompetitionPlayerLeaders(league, stat, 5);
    const leaders = rows.map((row: any) => ({
      name: row.player_name,
      team: row.team_short_name || row.team_name,
      teamCrest: row.team_crest,
      value: Number(row.value || 0),
    })).filter(row => row.value > 0);

    return NextResponse.json(leaders, {
      headers: { 'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging' ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Player statistics temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
