export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { postToSocials } from '@/app/lib/socialService';

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toISOString().split('T')[0];

    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .like('match_date', `${today}%`)
        .order('match_date', { ascending: true });

    if (!matches || matches.length === 0) return NextResponse.json({ message: "No games today" });

    let fbText = `📅 MATCHDAY SCHEDULE!\n\nAll games happening today:\n\n`;
    matches.forEach(m => {
        const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        fbText += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
    });
    fbText += `\nCatch all live scores and stats on FactSport!`;

    // Send to FB, skip X
    await postToSocials(fbText, null, "https://factsport.com"); 

    return NextResponse.json({ success: true, total_matches: matches.length });
}