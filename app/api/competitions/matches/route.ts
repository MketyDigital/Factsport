import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listPostgresLeagueMatches } from '@/lib/adapters/postgres-matches';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const revalidate = 15;

const ALLOWED_LEAGUES = new Set([
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'Champions League', 'World Cup', 'Euros', 'Copa America', 'AFCON',
]);

export async function GET(request: Request) {
  const league = new URL(request.url).searchParams.get('league') || '';
  if (!ALLOWED_LEAGUES.has(league)) {
    return NextResponse.json({ error: 'Invalid league' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    let matches: any[];
    if ((env.FACTSPORT_MATCHES_BACKEND ?? process.env.FACTSPORT_MATCHES_BACKEND) === 'postgres') {
      matches = await listPostgresLeagueMatches(league, 500);
    } else {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data, error } = await supabase
        .from('matches')
        .select('id, api_id, home_team, away_team, home_score, away_score, match_date, status, home_logo, away_logo, stage, match_group, venue')
        .eq('league', league)
        .order('match_date', { ascending: true })
        .limit(500);
      if (error) throw error;
      matches = data || [];
    }

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
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
