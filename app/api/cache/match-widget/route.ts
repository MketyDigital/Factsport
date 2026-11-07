export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getPostgresMatchById } from '@/lib/adapters/postgres-matches';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) return NextResponse.json({ error: 'Missing match ID' }, { status: 400 });

    const backend = env.FACTSPORT_MATCH_DETAIL_BACKEND ?? process.env.FACTSPORT_MATCH_DETAIL_BACKEND;
    if (backend === 'postgres') {
        try {
            const match = await getPostgresMatchById(matchId);
            if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
            return NextResponse.json({
                id: match.id, status: match.status, home_score: match.home_score, away_score: match.away_score,
                home_team: match.home_team, away_team: match.away_team, home_logo: match.home_logo,
                away_logo: match.away_logo, league: match.league, match_date: match.match_date,
            }, { headers: { 'Cache-Control': env.FACTSPORT_ENVIRONMENT === 'staging' ? 'private, no-store, max-age=0' : 'public, max-age=0, s-maxage=60' } });
        } catch {
            return NextResponse.json({ error: 'Match data temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
    }
    if (env.FACTSPORT_ENVIRONMENT !== 'development') {
        return NextResponse.json({ error: 'V2 match widget reader is not provisioned.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data, error } = await supabase
            .from('matches')
            .select('id, status, home_score, away_score, home_team, away_team, home_logo, away_logo, league, match_date')
            .eq('id', matchId)
            .single();

        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'max-age=0, s-maxage=60' } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}