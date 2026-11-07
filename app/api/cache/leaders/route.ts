export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { listCurrentCompetitionPlayerLeaders } from '@/lib/adapters/postgres-homepage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const leagueCode = searchParams.get('league');
    const type = searchParams.get('type') || 'goals'; 

    if (!leagueCode || !/^[A-Z0-9_-]{1,16}$/.test(leagueCode) || (type !== 'goals' && type !== 'assists')) return NextResponse.json({ error: 'Invalid league code or statistic' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

    const backend = env.FACTSPORT_COMPETITIONS_BACKEND ?? process.env.FACTSPORT_COMPETITIONS_BACKEND;
    if (backend === 'postgres') {
        try {
            const rows = await listCurrentCompetitionPlayerLeaders(leagueCode, type as 'goals' | 'assists', 5);
            const leaders = rows.map((row: any) => ({
                player_name: row.player_name, team_name: row.team_name,
                team_short_name: row.team_short_name, team_crest: row.team_crest,
                goals: type === 'goals' ? Number(row.value || 0) : Number(row.goals || 0),
                assists: type === 'assists' ? Number(row.value || 0) : Number(row.assists || 0),
            }));
            return NextResponse.json(leaders, { headers: { 'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging' ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=60' } });
        } catch {
            return NextResponse.json({ error: 'Player statistics temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
    }
    if (env.FACTSPORT_ENVIRONMENT === 'staging') {
        return NextResponse.json({ error: 'V2 competition statistics reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data, error } = await supabase
            .from('top_players')
            .select('*')
            .eq('league_code', leagueCode)
            .gt(type, 0)
            .order(type, { ascending: false })
            .limit(5);

        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'max-age=0, s-maxage=60' } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}