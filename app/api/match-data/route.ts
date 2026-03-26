import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
// ❌ Removed export const revalidate = 5; (It is ignored in dynamic routes anyway)

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

    // 🟢 DYNAMIC CACHE LOGIC: Protects your Supabase Limits
    const currentStatus = (data.status || '').toUpperCase();
    const isFinished = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'].includes(currentStatus);
    const isLive = ['LIVE', 'HT', 'IN_PLAY', '1H', '2H', 'ET', 'P'].includes(currentStatus);

    // Live = 5s cache | Scheduled = 60s cache | Finished = 1 hour cache
    let cacheSeconds = 60;
    if (isLive) cacheSeconds = 5;
    if (isFinished) cacheSeconds = 3600;

    // 🟢 SMOOTH POLLING: stale-while-revalidate keeps the UI completely seamless
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=10`,
        },
    });
}