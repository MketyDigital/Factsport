export const runtime = 'edge';
export const revalidate = 60; // 🟢 Cache for exactly 60 seconds

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const leagueCode = searchParams.get('league');

    if (!leagueCode) return NextResponse.json({ error: 'Missing league code' }, { status: 400 });

    try {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data, error } = await supabase
            .from('standings')
            .select('*')
            .eq('league_code', leagueCode)
            .order('position', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'max-age=0, s-maxage=60' } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}