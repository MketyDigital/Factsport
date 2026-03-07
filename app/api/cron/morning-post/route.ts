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

    // 🔒 THE SAFE LOCK (Using "-morning" so Evening Roundup doesn't get blocked!)
    const lockKey = `${today}-morning`;
    
    const { error: lockError } = await supabase.from('cron_logs').insert([{ run_date: lockKey }]);
    if (lockError) return NextResponse.json({ message: "Already posted today. Skipping." });
    
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .in('status', ['SCHEDULED', 'NS', 'PRE_MATCH', 'TIMED']) // Fetches unplayed games
        .order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        // Remove lock if there's nothing to post so we can try again if games get added
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "No upcoming games found for today. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 
    const todayString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

    // 🏆 GROUP MATCHES BY LEAGUE
    const leagues: Record<string, any[]> = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    let fb1Text = `📅 ${todayString.toUpperCase()} MATCHDAY SCHEDULE!\n\n`;
    for (const [league, leagueMatches] of Object.entries(leagues)) {
        fb1Text += `🏆 ${league}\n`;
        leagueMatches.forEach(m => {
            const time = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
            fb1Text += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
        });
        fb1Text += `\n`; 
    }
    fb1Text += `⏰ All kick-off times are in GMT.\nCatch all live scores and stats on: ${frontendUrl} 🏆`;

    // 🖼️ BASE64 ENCRYPTION FOR IMAGE URL (Safe to pass up to 14 matches now!)
    const topMatches = matches.slice(0, 14).map(m => ({
        home: m.home_team,
        away: m.away_team,
        time: new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' })
    }));
    
    const ogPayload = { type: 'schedule', label: 'MATCHDAY', matches: topMatches };
    const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
    const scheduleOgUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    
    // 🐦 DYNAMIC TWITTER TEXT
    const dynamicXText = `📅 ${todayString} Matchday is here!\n\nWe have ${matches.length} massive games lined up today. Who are you backing? Drop your predictions below 👇`;

    try {
        await postToSocials({ fb1Message: fb1Text, xMessage: dynamicXText, xImageUrl: scheduleOgUrl }); 
        return NextResponse.json({ success: true, total_matches: matches.length });
    } catch (e) {
        // 🚨 SELF-HEALING: If posting fails, delete the specific morning lock so we can try again!
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ error: "Posting failed. Lock removed for retry." }, { status: 500 });
    }
}