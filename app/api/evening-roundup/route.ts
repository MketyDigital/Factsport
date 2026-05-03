export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

// 🟢 TS FIX: Added : string
function parseArticleTemplate(templateText: string, generatedContent: string, link: string) {
    if (!templateText) return null;
    return templateText.replace(/\[AI_TEXT\]/g, generatedContent).replace(/\[LINK\]/g, link);
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const now = new Date();
    if (now.getUTCHours() < 6) now.setUTCDate(now.getUTCDate() - 1);
    const targetDate = now.toISOString().split('T')[0];
    const lockKey = `${targetDate}-evening`; 
    
    const { error: lockError } = await supabase.from('cron_logs').insert([{ run_date: lockKey }]);
    if (lockError) return NextResponse.json({ message: "Evening roundup already posted today. Skipping." });
    
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();

    const { data: matches, error } = await supabase.from('matches').select('*').gte('match_date', startOfDay).lte('match_date', endOfDay).order('match_date', { ascending: true });

    if (error || !matches || matches.length === 0) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "No games found for today. Lock removed." });
    }

    const validMatches = matches.filter(m => {
        const status = (m.status || '').toUpperCase();
        if (INVALID_STATUSES.includes(status)) return false;
        return true;
    });

    if (validMatches.length === 0) {
        await supabase.from('cron_logs').delete().eq('run_date', lockKey);
        return NextResponse.json({ message: "Only ghost/postponed matches found. Lock removed." });
    }

    const frontendUrl = 'https://factsport.com'; 
    const leagues: Record<string, any[]> = {};
    validMatches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    let rawFbText = `🏁 DAILY ROUNDUP!\n\nHere is the result sheet across today's fixtures:\n\n`;
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        rawFbText += `🏆 ${leagueName.toUpperCase()}\n`;
        leagueMatches.forEach(m => {
            const status = (m.status || '').toUpperCase();
            if (FINISHED_STATUSES.includes(status)) {
                rawFbText += `⚽ ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}\n`;
            } else {
                rawFbText += `⏳ ${m.home_team} vs ${m.away_team}\n`;
            }
        });
        rawFbText += `\n`;
    }

    let rawXText = `🏁 DAILY ROUNDUP!\n\n`;
    validMatches.slice(0, 8).forEach(m => {
        const status = (m.status || '').toUpperCase();
        if (FINISHED_STATUSES.includes(status)) rawXText += `• ${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}\n`;
        else rawXText += `• ⏳ ${m.home_team} vs ${m.away_team}\n`;
    });

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

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const res = await fetch(resultsOgUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) await res.arrayBuffer(); 
    } catch (e) { }

    try {
        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        const config = settingsData?.social_config || {};
        const creds = config.credentials || {};
        const events = config.events || {};
        const summaryConfig = events.daily_summary || {};
        const templates = config.templates?.daily_summary || {};

        const link = `${frontendUrl}/matches`;

        const fb1Text = parseArticleTemplate(templates.fb1 || `[AI_TEXT]\n\nFull results, stats, player ratings & tactical news: [LINK] 🏆`, rawFbText, link);
        const fb2Text = parseArticleTemplate(templates.fb2 || fb1Text!, rawFbText, link);
        const make1Text = parseArticleTemplate(templates.make1 || `[AI_TEXT]\n\nFull results & stats : [LINK] 👇🏼`, rawXText, link);
        const make2Text = parseArticleTemplate(templates.make2 || make1Text!, rawXText, link);

        if (summaryConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb1Text, x_text: make1Text, x_image_url: resultsOgUrl }) }).catch(()=>{});
        }
        if (summaryConfig.make2 && creds.make_webhook_2) {
            await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb2Text, x_text: make2Text, x_image_url: resultsOgUrl }) }).catch(()=>{});
        }
        if (summaryConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID;
            const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(resultsOgUrl)}&message=${encodeURIComponent(fb1Text!)}&access_token=${token}`, { method: 'POST' }).catch(()=>{});
        }
        if (summaryConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(resultsOgUrl)}&message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`, { method: 'POST' }).catch(()=>{});
        }
        if (summaryConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
            for (const channel of creds.tg_general_channels) {
                if (channel.wants_summary) {
                    const tgMsg = parseArticleTemplate(templates.tg_general || `🌙 <b>MATCHDAY ROUND-UP</b>\n\n[AI_TEXT]\n\n👇 <b>Full stats here:</b>\n[LINK] 🏆`, rawFbText, link);
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