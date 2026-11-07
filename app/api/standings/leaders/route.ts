import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';
import { listCurrentCompetitionPlayerLeaders } from '@/lib/adapters/postgres-homepage';

export const runtime = 'edge';
export const revalidate = 300;

const LEAGUE_CODES = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC', 'EC', 'CLI', 'AFCON']);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const league = params.get('league') || 'PL';
  const stat = params.get('stat') || 'goals';

  if (!LEAGUE_CODES.has(league) || (stat !== 'goals' && stat !== 'assists')) {
    return NextResponse.json({ error: 'Invalid league or statistic' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    let leaders: any[];
    const backend = env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND;
    if (backend !== 'postgres' && env.FACTSPORT_ENVIRONMENT === 'staging') return NextResponse.json({ error: 'V2 player statistics reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    if (backend === 'postgres') {
      const rows = await listCurrentCompetitionPlayerLeaders(league, stat, 5);
      leaders = rows.map((row: any) => ({
        name: row.player_name,
        team: row.team_short_name || row.team_name,
        teamCrest: row.team_crest,
        value: Number(row.value || 0),
      }));
    } else {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data, error } = await supabase
        .from('tournament_scorers')
        .select('player_name, team_name, team_short_name, team_crest, goals, assists')
        .eq('league_code', league)
        .order(stat, { ascending: false })
        .limit(5);
      if (error) throw error;
      leaders = (data || []).map((row: any) => ({
        name: row.player_name,
        team: row.team_short_name || row.team_name,
        teamCrest: row.team_crest,
        value: Number(row[stat] || 0),
      })).filter(row => row.value > 0);
    }

    return NextResponse.json(leaders, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Player statistics temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
