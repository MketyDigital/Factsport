import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

// 🟢 THE SHIELD: Caches the database response for 5 seconds at the edge.
export const revalidate = 5; 

export async function GET(request: Request) {
    // 🛡️ THE BOUNCER LOGIC
    if (process.env.NODE_ENV === 'production') {
        const referer = request.headers.get('referer') || '';
        const fetchSite = request.headers.get('sec-fetch-site') || '';
        const isBrowser = referer.includes('factsport.com') || fetchSite === 'same-origin';
        
        // 🎫 THE VIP PASS: If you ever need to hit this with a cron job, just send your CRON_KEY!
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

    return NextResponse.json(data);
}