export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 🟢 STATUS LISTS
const FINISHED_STATUSES = ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'];
const LIVE_STATUSES = ['LIVE', 'IN_PLAY', 'IN', '1H', '2H', 'HT', 'HALFTIME', 'ET', 'EXTRA TIME', 'P', 'PENALTIES'];
const INVALID_STATUSES = ['POSTPONED', 'PST', 'CANC', 'CANCELLED', 'TBD', 'ABD'];

function encodeBase64Safe(obj: any) {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    try {
        const nowIso = new Date().toISOString();
        const { data: expiredCamps } = await supabase.from('campaigns').select('id').eq('is_active', true).lt('end_date', nowIso);
        if (expiredCamps && expiredCamps.length > 0) {
            const expiredIds = expiredCamps.map(c => c.id);
            await supabase.from('matches').update({ campaign_id: null }).in('campaign_id', expiredIds);
            await supabase.from('campaigns').update({ is_active: false }).in('id', expiredIds);
        }
    } catch (e) { }

    const today = new Date().toISOString().split('T')[0];
    const lockKey = `${today}-morning`;
    
    const { error: lockError } = await supabase.from('cron_logs').insert([{ run_date: lockKey }]);
    if (lockError) return NextResponse.json({ message: "Already posted today. Skipping." });
    
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase.from('matches').select('*').gte('match_date', startOfDay).lte('match_date', endOfDay).order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "No upcoming games found for today. Lock removed." });
    }

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

    const frontendUrl = 'https://factsport.com'; 
    const todayString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const leagues: Record<string, any[]> = {};
    
    validMatches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    let fbText = `📅 ${todayString.toUpperCase()} MATCHDAY SCHEDULE!\n\n`;
    for (const [league, leagueMatches] of Object.entries(leagues)) {
        fbText += `🏆 ${league}\n`;
        leagueMatches.forEach(m => {
            const status = (m.status || '').toUpperCase();
            if (FINISHED_STATUSES.includes(status)) {
                fbText += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (FT)\n`;
            } else if (LIVE_STATUSES.includes(status)) {
                fbText += `🔴 ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (LIVE)\n`;
            } else {
                const time = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
                fbText += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
            }
        });
        fbText += `\n`; 
    }
    fbText += `⏰ All kick-off times are in GMT.\nCatch all live scores and stats on: ${frontendUrl}/matches 🏆`;

    let xText = `📅 ${todayString} Matchday is here!\n\nWe have ${validMatches.length} massive games lined up today. What are your Predictions for the day? Full fixtures on: ${frontendUrl}/matches 👇🏼`;

    const topMatches = validMatches.slice(0, 10).map(m => {
        const status = (m.status || '').toUpperCase();
        let timeOrScore = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
        if (FINISHED_STATUSES.includes(status) || LIVE_STATUSES.includes(status)) timeOrScore = `${m.home_score} - ${m.away_score}`;
        return { home: m.home_team, away: m.away_team, time: timeOrScore };
    });
    
    const ogPayload = { type: 'schedule', label: 'MATCHDAY SCHEDULE', matches: topMatches };
    const safeBase64 = encodeBase64Safe(ogPayload);
    const scheduleOgUrl = `${frontendUrl}/api/og?data=${safeBase64}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const res = await fetch(scheduleOgUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) await res.arrayBuffer(); 
    } catch (e) { }
    
    // ====================================================================================
    // 🟢 THE NEW DYNAMIC MULTI-ACCOUNT BROADCASTER
    // ====================================================================================
    try {
        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        const config = settingsData?.social_config || {};
        const creds = config.credentials || {};
        const events = config.events || {};
        
        const previewConfig = events.daily_preview || {};

        // 1. MAKE.COM 1
        if (previewConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: scheduleOgUrl }) }).catch(()=>{});
        }
        // 2. MAKE.COM 2
        if (previewConfig.make2 && creds.make_webhook_2) {
            await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: scheduleOgUrl }) }).catch(()=>{});
        }
        // 3. FACEBOOK 1 (Direct API)
        if (previewConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID;
            const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(scheduleOgUrl)}&message=${encodeURIComponent(fbText)}&access_token=${token}`, { method: 'POST' }).catch(()=>{});
        }
        // 4. FACEBOOK 2 (Direct API)
        if (previewConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(scheduleOgUrl)}&message=${encodeURIComponent(fbText)}&access_token=${creds.fb2_token}`, { method: 'POST' }).catch(()=>{});
        }
        // 5. TELEGRAM GENERAL (Checks channel checkboxes!)
        if (previewConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
            for (const channel of creds.tg_general_channels) {
                if (channel.wants_preview) {
                    const tgMsg = `☀️ <b>MATCHDAY PREVIEW</b>\n\n${fbText}`;
                    await fetch(`https://api.telegram.org/bot${creds.telegram_bot_token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: channel.chatId, text: tgMsg, parse_mode: 'HTML', disable_web_page_preview: true }) }).catch(()=>{});
                }
            }
        }

        return NextResponse.json({ success: true, total_matches: validMatches.length });
    } catch (e) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ error: "Posting failed. Lock removed for retry." }, { status: 500 });
    }
}