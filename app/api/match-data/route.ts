import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

// 🛡️ VERCEL SHIELD: Forces Vercel's Edge Cache to group user requests together
export const revalidate = 5; 
export const runtime = 'edge';

export async function GET(request: Request) {
    // 🛡️ THE BOUNCER LOGIC
    if (process.env.NODE_ENV === 'production') {
        const referer = request.headers.get('referer') || '';
        const fetchSite = request.headers.get('sec-fetch-site') || '';
        const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
        
        // 🎫 THE VIP PASS
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
    
    // 🔥 THE SWEET SPOT: We fetch the score/clock AND the live events, stats, and lineups.
    // We leave out pro_analysis and affiliate links because those don't change by the minute.
    const { data, error } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score, displayClock, widget_id, match_events, lineups, stats')
        .eq('id', matchId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // 🔥 CACHE RULES: Browser asks instantly, Cloudflare/Vercel holds for exactly 5s.
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'max-age=0, s-maxage=5',
        },
    });
}