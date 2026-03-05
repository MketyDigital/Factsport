export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// 👇 These were the missing imports causing the build crash!
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server'; 
import { postToSocials } from '@/app/lib/socialService';

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // 🟢 Robust Start and End of Day (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .order('match_date', { ascending: true });

    if (error) {
        console.error("Supabase Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

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