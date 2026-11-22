export const runtime = 'edge';
export const revalidate = 60;

import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listCurrentCompetitionPlayerLeaders } from '@/lib/adapters/postgres-homepage';

const ALLOWED_LEAGUES = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1']);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const leagueCode = params.get('league') || '';
  const type = params.get('type') || 'goals';
  if (!ALLOWED_LEAGUES.has(leagueCode) || (type !== 'goals' && type !== 'assists')) {
    return NextResponse.json({ error: 'Invalid league code or statistic' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }

  if ((env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND) !== 'postgres') {
    return NextResponse.json({ error: 'V2 competition statistics reader is not provisioned.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const rows = await listCurrentCompetitionPlayerLeaders(leagueCode, type, 5);
    const leaders = rows.map((row: any) => ({
      player_name: row.player_name,
      team_name: row.team_name,
      team_short_name: row.team_short_name,
      team_crest: row.team_crest,
      goals: type === 'goals' ? Number(row.value || 0) : Number(row.goals || 0),
      assists: type === 'assists' ? Number(row.value || 0) : Number(row.assists || 0),
    }));
    const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
    return NextResponse.json(leaders, {
      headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=60' },
    });
  } catch {
    return NextResponse.json({ error: 'Player statistics temporarily unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
