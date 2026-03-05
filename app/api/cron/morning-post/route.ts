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

    // 🔒 The Morning Lock
    const { error: lockError } = await supabase.from('cron_logs').insert([{ run_date: today }]);
    if (lockError) {
        return NextResponse.json({ message: "Already posted today. Skipping." });
    }
    
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .order('match_date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!matches || matches.length === 0) return NextResponse.json({ message: "No games today." });

    // 🔗 THE URL SPLIT
    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 

    // 🧠 DYNAMIC DATE GENERATOR (e.g., "Thursday, 5 Mar")
    const todayString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

    // 1. DYNAMIC FB1 TEXT
    let fb1Text = `📅 ${todayString.toUpperCase()} MATCHDAY SCHEDULE!\n\nAll games happening today:\n\n`;
    matches.forEach(m => {
        const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        fb1Text += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
    });
    // Link points to the live website
    fb1Text += `\nCatch all live scores and stats on: ${frontendUrl}`;

    // 2. BUILD X GRAPHIC DATA
    const topMatches = matches.slice(0, 14);
    const ogMatchesString = topMatches.map(m => {
        const time = new Date(m.match_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `${m.home_team}_${m.away_team}_${time}`;
    }).join('|');
    
    // Image URL points to the Vercel app
    const scheduleOgUrl = `${imageUrl}/api/og?type=schedule&matches=${encodeURIComponent(ogMatchesString)}&ext=.png`;

    // 3. DYNAMIC X TEXT
    const dynamicXText = `📅 ${todayString} Matchday is here!\n\nWe have ${matches.length} massive games lined up today. Who are you backing? Drop your predictions below 👇`;

    await postToSocials({
        fb1Message: fb1Text,
        xMessage: dynamicXText,
        xImageUrl: scheduleOgUrl
    }); 

    return NextResponse.json({ success: true, total_matches: matches.length });
}