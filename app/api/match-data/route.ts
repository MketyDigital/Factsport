import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export const revalidate = 5; 
export const runtime = 'edge';

export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        const referer = request.headers.get('referer') || '';
        const fetchSite = request.headers.get('sec-fetch-site') || '';
        const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
        
        const authHeader = request.headers.get('Authorization') || '';
        const isVIP = authHeader === `Bearer ${process.env.CRON_KEY}`;

        if (!isBrowser && !isVIP) {
            return NextResponse.json({ error: 'Direct API access is protected.' }, { status: 403 });
        }
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('id');

    if (!matchId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const supabase = createClient();
    
    const { data, error } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, displayClock, widget_id, match_events, lineups, stats')
        .eq('id', matchId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 🟢 SMOOTH POLLING: Added stale-while-revalidate so users never see a loading spinner.
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'max-age=0, s-maxage=5, stale-while-revalidate=10',
        },
    });
}