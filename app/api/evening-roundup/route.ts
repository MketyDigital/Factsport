export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { postToSocials } from '@/app/lib/socialService';

// 🟢 CLOUDFLARE EDGE-SAFE ENCODER
function encodeBase64Safe(obj: any) {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const now = new Date();
    if (now.getUTCHours() < 6) {
        now.setUTCDate(now.getUTCDate() - 1);
    }
    const targetDate = now.toISOString().split('T')[0];
    const lockKey = `${targetDate}-evening`; 
    
    const { error: lockError } = await supabase.from('cron_logs').insert([{ run_date: lockKey }]);
    
    if (lockError) {
        console.error("Lock Error:", lockError.message);
        return NextResponse.json({ message: "Evening roundup already posted today. Skipping." });
    }
    
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
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "No finished games found. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com'; 

    const leagues: Record<string, any[]> = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    let fb1Text = `🏁 FULL TIME RESULTS!\n\nHere is how today played out across the major leagues:\n\n`;
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        fb1Text += `🏆 ${leagueName.toUpperCase()}\n`;
        leagueMatches.forEach(m => {
            fb1Text += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
        });
        fb1Text += `\n`;
    }
    fb1Text += `Full stats, player ratings & tactical news: ${frontendUrl} 🏆`;

    let xText = `🏁 DAILY RESULTS!\n\n`;
    matches.slice(0, 8).forEach(m => {
        xText += `• ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}\n`;
    });
    xText += `\nFull stats & news: ${frontendUrl}`;

    // 🖼️ TWITTER RESULTS GRID IMAGE
    const topMatches = matches.slice(0, 10).map(m => ({
        home: m.home_team,
        away: m.away_team,
        score: `${m.home_score} - ${m.away_score}`
    }));
    
    const ogPayload = { type: 'schedule', label: 'FULL TIME RESULTS', matches: topMatches };
    const safeBase64 = encodeBase64Safe(ogPayload);
    const resultsOgUrl = `${frontendUrl}/api/og?data=${safeBase64}`;

    try {
        await postToSocials({ fb1Message: fb1Text, xMessage: xText, xImageUrl: resultsOgUrl }); 
        return NextResponse.json({ success: true, total_matches: matches.length });
    } catch (e) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ error: "Posting failed. Lock removed for retry." }, { status: 500 });
    }
}