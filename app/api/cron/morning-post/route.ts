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

// 🟢 ORIGINAL IMAGEKIT LOGIC RESTORED
const getImageKitProxyUrl = (rawUrl: string) => {
    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/+$/, '');
    if (!endpoint) return rawUrl;
    return `${endpoint}/tr:f-png/${encodeURIComponent(rawUrl)}`;
};

// 🟢 TS TYPES ADDED SO VERCEL BUILDS CORRECTLY
function parseArticleTemplate(templateText: string, generatedContent: string, link: string) {
    if (!templateText) return null;
    return templateText.replace(/\[AI_TEXT\]/g, generatedContent).replace(/\[LINK\]/g, link);
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

    let rawFbText = `📅 ${todayString.toUpperCase()} MATCHDAY SCHEDULE!\n\n`;
    for (const [league, leagueMatches] of Object.entries(leagues)) {
        rawFbText += `🏆 ${league}\n`;
        leagueMatches.forEach(m => {
            const time = new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' });
            rawFbText += `⚽ ${m.home_team} vs ${m.away_team} (${time})\n`;
        });
        rawFbText += `\n`; 
    }
    rawFbText += `⏰ Kick-off times in GMT.`;

    let rawXText = `📅 ${todayString} Matchday is here!\n\nWe have ${validMatches.length} massive games lined up today. What are your Predictions for the day?`;

    const topMatches = validMatches.slice(0, 10).map(m => {
        return { home: m.home_team, away: m.away_team, time: new Date(m.match_date).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute:'2-digit' }) };
    });
    
    const ogPayload = { type: 'schedule', label: 'MATCHDAY SCHEDULE', matches: topMatches };
    const safeBase64 = encodeBase64Safe(ogPayload);
    const scheduleOgUrl = `${frontendUrl}/api/og?data=${safeBase64}`;
    
    // 🟢 Proxy the URL via ImageKit
    const proxiedImage = getImageKitProxyUrl(scheduleOgUrl);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const res = await fetch(scheduleOgUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) await res.arrayBuffer(); 
    } catch (e) { }
    
    try {
        const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
        const config = settingsData?.social_config || {};
        const creds = config.credentials || {};
        const events = config.events || {};
        const previewConfig = events.daily_preview || {};
        const templates = config.templates?.daily_preview || {};

        const link = `${frontendUrl}/matches`;

        const fb1Text = parseArticleTemplate(templates.fb1 || `[AI_TEXT]\n\nCatch all live scores and stats on: [LINK] 🏆`, rawFbText, link);
        const fb2Text = parseArticleTemplate(templates.fb2 || fb1Text!, rawFbText, link);
        const make1Text = parseArticleTemplate(templates.make1 || `[AI_TEXT]\n\nFull fixtures on: [LINK] 👇🏼`, rawXText, link);
        const make2Text = parseArticleTemplate(templates.make2 || make1Text!, rawXText, link);

        const makePayload1: any = { fb2_text: fb1Text, x_text: make1Text, x_image_url: proxiedImage };
        const makePayload2: any = { fb2_text: fb2Text, x_text: make2Text, x_image_url: proxiedImage };

        if (previewConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makePayload1) }).catch(()=>{});
        }
        if (previewConfig.make2 && creds.make_webhook_2) {
            await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makePayload2) }).catch(()=>{});
        }
        if (previewConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID;
            const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(proxiedImage)}&message=${encodeURIComponent(fb1Text!)}&access_token=${token}`, { method: 'POST' }).catch(()=>{});
        }
        if (previewConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(proxiedImage)}&message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`, { method: 'POST' }).catch(()=>{});
        }
        if (previewConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
            for (const channel of creds.tg_general_channels) {
                if (channel.wants_preview) {
                    const tgMsg = parseArticleTemplate(templates.tg_general || `☀️ <b>MATCHDAY PREVIEW</b>\n\n[AI_TEXT]\n\n👇 <b>Full fixtures here:</b>\n[LINK] 🏆`, rawFbText, link);
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