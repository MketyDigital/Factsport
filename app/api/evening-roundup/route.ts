export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { postToSocials } from '@/app/lib/socialService';

// 🟢 STATUS LISTS
const FINISHED_STATUSES = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const INVALID_STATUSES = ['POSTPONED', 'PST', 'CANC', 'CANCELLED', 'TBD', 'ABD'];

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
    if (lockError) return NextResponse.json({ message: "Evening roundup already posted today. Skipping." });
    
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay)
        .order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "No games found for today. Lock removed." });
    }

    // 👻 THE GHOST FILTER
    const validMatches = matches.filter(m => {
        const status = (m.status || '').toUpperCase();
        if (INVALID_STATUSES.includes(status)) return false;
        
        const isMidnight = m.match_date.includes('T00:00:00');
        const isZeroZero = m.home_score === 0 && m.away_score === 0;
        
        if (FINISHED_STATUSES.includes(status) && isMidnight && isZeroZero) {
            const hasEvents = m.match_events && Array.isArray(m.match_events) && m.match_events.length > 0;
            const hasLineups = m.lineups && m.lineups.home && Array.isArray(m.lineups.home) && m.lineups.home.length > 0;
            if (!hasEvents && !hasLineups) return false; 
        }
        return true;
    });

    if (validMatches.length === 0) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "Only ghost/postponed matches found. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com/matches'; 
    const leagues: Record<string, any[]> = {};
    validMatches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    // 🟢 FACEBOOK FORMAT
    let fb1Text = `🏁 DAILY ROUNDUP!\n\nHere is the result sheet across today's fixtures:\n\n`;
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        fb1Text += `🏆 ${leagueName.toUpperCase()}\n`;
        leagueMatches.forEach(m => {
            const status = (m.status || '').toUpperCase();
            if (FINISHED_STATUSES.includes(status)) {
                fb1Text += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
            } else if (LIVE_STATUSES.includes(status)) {
                fb1Text += `🔴 ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (${m.displayClock || 'LIVE'})\n`;
            } else {
                const time = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
                fb1Text += `⏳ ${m.home_team} vs ${m.away_team} (${time})\n`;
            }
        });
        fb1Text += `\n`;
    }
    fb1Text += `Full results, stats, player ratings & tactical news: ${frontendUrl} 🏆`;

    // 🟢 X/TWITTER FORMAT
    let xText = `🏁 DAILY ROUNDUP!\n\n`;
    validMatches.slice(0, 8).forEach(m => {
        const status = (m.status || '').toUpperCase();
        if (FINISHED_STATUSES.includes(status)) {
            xText += `• ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}\n`;
        } else if (LIVE_STATUSES.includes(status)) {
            xText += `• 🔴 ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team} (${m.displayClock || 'LIVE'})\n`;
        } else {
            const time = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
            xText += `• ⏳ ${m.home_team} vs ${m.away_team} (${time})\n`;
        }
    });
    xText += `\nFull results & stats : ${frontendUrl}`;

    // 🖼️ IMAGE GENERATION
    const topMatches = validMatches.slice(0, 10).map(m => {
        const status = (m.status || '').toUpperCase();
        let displayScore = `${m.home_score} - ${m.away_score}`;
        if (!FINISHED_STATUSES.includes(status) && !LIVE_STATUSES.includes(status)) {
            displayScore = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
        }
        return { home: m.home_team, away: m.away_team, score: displayScore };
    });
    
    const ogPayload = { type: 'schedule', label: 'DAILY ROUNDUP', matches: topMatches };
    const safeBase64 = encodeBase64Safe(ogPayload);
    const resultsOgUrl = `${frontendUrl}/api/og?data=${safeBase64}`;

    // 🟢 UPDATED: SAFE PRE-WARM CACHE (Strict render wait with fallback)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second max wait

        const res = await fetch(resultsOgUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        // Force Vercel to pull the image file fully into memory
        if (res.ok) await res.arrayBuffer(); 
    } catch (e) {
        console.error(`Cache warm timeout/error for Evening Roundup. Firing webhook anyway.`);
    }

    try {
        await postToSocials({ fb1Message: fb1Text, xMessage: xText, xImageUrl: resultsOgUrl }); 
        return NextResponse.json({ success: true, total_matches: validMatches.length });
    } catch (e) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ error: "Posting failed. Lock removed for retry." }, { status: 500 });
    }
}