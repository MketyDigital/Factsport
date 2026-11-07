export const runtime = 'edge';
export const revalidate = 60; // 🟢 Cache for exactly 60 seconds

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listCurrentCompetitionStandings } from '@/lib/adapters/postgres-homepage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const leagueCode = searchParams.get('league');

    const allowed = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'WC', 'EC', 'CLI', 'AFCON']);
    if (!leagueCode || !allowed.has(leagueCode)) return NextResponse.json({ error: 'Invalid league code' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    try {
        const backend = env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND;
        if (backend !== 'postgres' && (env.FACTSPORT_ENVIRONMENT === 'staging' || env.FACTSPORT_ENVIRONMENT === 'production')) return NextResponse.json({ error: 'V2 standings reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        const data = backend === 'postgres'
            ? await listCurrentCompetitionStandings(leagueCode)
            : await (async () => {
                const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                const { data, error } = await supabase
                    .from('standings')
                    .select('league_code, league_name, season, match_group, team_id, team_name, team_short_name, team_crest, position, played_games, won, draw, lost, goals_for, goals_against, goal_difference, points, source_updated_at')
                    .eq('league_code', leagueCode)
                    .order('match_group', { ascending: true })
                    .order('position', { ascending: true });
                if (error) throw error;
                return data || [];
            })();
        const staging = env.FACTSPORT_ENVIRONMENT === 'staging';
        return NextResponse.json(data, { headers: { 'Cache-Control': staging ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' } });
    } catch {
        return NextResponse.json({ error: 'Standings temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}