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
    
    const now = new Date();
    // 🛡️ DATE-DRIFT: If running between 00:00 and 05:59 UTC, look at "yesterday"
    if (now.getUTCHours() < 6) {
        now.setUTCDate(now.getUTCDate() - 1);
    }
    const today = now.toISOString().split('T')[0];

    // 🔒 THE INITIAL LOCK (Prevent Duplicates)
    const { error: lockError } = await supabase.from('cron_logs_evening').insert([{ run_date: today }]);
    if (lockError) return NextResponse.json({ message: "Evening roundup already posted today. Skipping." });
    
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'])
        .order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        // 🚨 SELF-HEALING: Delete the lock if no games found so it can try again later
        await supabase.from('cron_logs_evening').delete().eq('run_date', today);
        return NextResponse.json({ message: "No games finished yet. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com'; 

    // 🏆 GROUP BY LEAGUE
    const leagues: Record<string, any[]> = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    // FACEBOOK TEXT: Detailed and grouped by league
    let fb1Text = `🏁 FULL TIME RESULTS!\n\nHere is how today played out across the major leagues:\n\n`;
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        fb1Text += `🏆 ${leagueName.toUpperCase()}\n`;
        leagueMatches.forEach(m => {
            fb1Text += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
        });
        fb1Text += `\n`;
    }
    fb1Text += `Full stats, player ratings & tactical news: ${frontendUrl} 🏆`;

    // X TEXT: Short and punchy for character limits
    let xText = `🏁 DAILY RESULTS!\n\n`;
    matches.slice(0, 8).forEach(m => {
        xText += `• ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}\n`;
    });
    xText += `\nFull stats & news: ${frontendUrl}`;

    try {
        await postToSocials({ fb1Message: fb1Text, xMessage: xText }); 
        return NextResponse.json({ success: true, total_matches: matches.length });
    } catch (e) {
        // 🚨 SELF-HEALING: Delete lock if the actual posting fails
        await supabase.from('cron_logs_evening').delete().eq('run_date', today);
        return NextResponse.json({ error: "Posting failed. Lock removed." }, { status: 500 });
    }
}