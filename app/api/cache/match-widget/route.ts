export const runtime = 'edge';
export const revalidate = 60;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) return NextResponse.json({ error: 'Missing match ID' }, { status: 400 });

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