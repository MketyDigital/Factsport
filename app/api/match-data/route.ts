import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

// You can remove export const revalidate = 5; because the headers do the real work now!

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
    
    // Grabs everything your client components need in one read
    const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

    // 🟢 THE TRUE SHIELD: Cloudflare Edge Caching
    // s-maxage=5: Cloudflare caches this exact response globally for 5 seconds.
    // stale-while-revalidate=5: Serves stale data quickly while fetching fresh data in the background.
    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5',
        },
    });
}