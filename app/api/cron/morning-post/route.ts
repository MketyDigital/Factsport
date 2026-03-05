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

    // 1. Build FB1 Text List
    let fb1Text = `📅 MATCHDAY SCHEDULE!\n\nAll games happening today:\n\n`;
    matches.forEach(m => {
        const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        fb1Text += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
    });
    fb1Text += `\nCatch all live scores and stats on FactSport!`;

    // 2. Build X Graphic Data (Max 14 matches for the image layout)
    const topMatches = matches.slice(0, 14);
    const ogMatchesString = topMatches.map(m => {
        const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `${m.home_team}_${m.away_team}_${time}`;
    }).join('|');
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com';
    const scheduleOgUrl = `${baseUrl}/api/og?key=${process.env.CRON_KEY}&type=schedule&matches=${encodeURIComponent(ogMatchesString)}`;

    await postToSocials({
        fb1Message: fb1Text,
        xMessage: "📅 Matchday is here! Who you got? Drop your predictions below 👇",
        xImageUrl: scheduleOgUrl,
        link: baseUrl
    }); 

    return NextResponse.json({ success: true, total_matches: matches.length });
}