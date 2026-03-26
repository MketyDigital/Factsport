export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

const getValidGoals = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        const text = String(e.text || '').toLowerCase();
        const type = String(e.type || '').toLowerCase();
        if (text.includes('disallowed') || text.includes('cancelled') || text.includes('no goal') || type === 'var_overturn' || type === 'penalty_awarded') return false;
        return type === 'goal' || text === 'goal';
    });
};

const getPenaltyEvents = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        const type = String(e.type || '').toLowerCase();
        const text = String(e.text || '').toLowerCase();
        return type === 'penalty_awarded' || text.includes('penalty awarded');
    });
};

const parseTime = (t: any) => {
    const str = String(t).replace(/[^0-9+]/g, ''); 
    const parts = str.split('+');
    return (parseInt(parts[0]) || 0) * 100 + (parseInt(parts[1]) || 0); 
};

const getMatchHashtag = (home: string, away: string, homeTla?: string, awayTla?: string) => {
    const cleanH = homeTla || home.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3);
    const cleanA = awayTla || away.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3);
    return `#${cleanH.toUpperCase()}${cleanA.toUpperCase()} #FactSportLive`;
};

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

// 🟢 HELPER TO GENERATE MATCH IMAGES
const getMatchImageUrl = (label: string, state: any, baseUrl: string) => {
    const payload = { 
        type: 'versus', label: label, 
        home: state.home_team, away: state.away_team, 
        hScore: state.home_score, aScore: state.away_score,
        homeLogo: state.home_logo, awayLogo: state.away_logo
    };
    return `${baseUrl}/api/og?data=${encodeBase64Safe(payload)}`;
};

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };
    if (!newState) return NextResponse.json({ message: "No record found" });

    const oldStatus = String(oldState.status).toUpperCase();
    const newStatus = String(newState.status).toUpperCase();

    const strictlyFinishedStatuses = ['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED'];
    if (strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        return NextResponse.json({ message: "Match already finished. Ignoring late correction." });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);
    
    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => isBigTeamMatch(m.home_team, m.away_team));
        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team." });
        if (todaysMatches && todaysMatches.length > 0 && newState.id === todaysMatches[0].id) isVIP = true;
        else return NextResponse.json({ message: "Not the fallback match." });
    }

    const frontendUrl = 'https://factsport.com'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    const hashtags = getMatchHashtag(newState.home_team, newState.away_team, newState.home_tla, newState.away_tla); 
    
    let payload: SocialPayload = {}; 

    const oldTotal = (oldState.home_score || 0) + (oldState.away_score || 0);
    const newTotal = (newState.home_score || 0) + (newState.away_score || 0);
    const oldGoalsList = getValidGoals(oldState.match_events || []);
    const newGoalsList = getValidGoals(newState.match_events || []);
    const oldPenaltiesList = getPenaltyEvents(oldState.match_events || []);
    const newPenaltiesList = getPenaltyEvents(newState.match_events || []);

    const getValidNames = (arr: any[]) => (Array.isArray(arr) ? arr : []).map(p => p?.name || (typeof p === 'string' ? p : null)).filter(Boolean);
    const oldValidH = getValidNames(oldState.lineups?.home); const oldValidA = getValidNames(oldState.lineups?.away);
    const newValidH = getValidNames(newState.lineups?.home); const newValidA = getValidNames(newState.lineups?.away);
    const oldWasIncomplete = oldValidH.length < 11 || oldValidA.length < 11;
    const newIsComplete = newValidH.length >= 11 && newValidA.length >= 11;

    const preStatuses = ['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD'];
    const live1HStatuses = ['IN_PLAY', 'LIVE', '1H', 'FIRST_HALF', 'FIRST HALF'];
    const htStatuses = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME', 'PAUSED'];
    const live2HStatuses = ['2H', 'SECOND_HALF', 'SECOND HALF'];

    // 🟢 1. VAR DECISIONS
    if (newTotal < oldTotal) {
        payload.fb1Message = `❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
    } 
    // 🟢 2. GOALS 
    else if (newTotal > oldTotal || newGoalsList.length > oldGoalsList.length) {
        if (newGoalsList.length < newTotal) return NextResponse.json({ message: "Facts data lagging behind scoreboard. Waiting for next ping." });
        let statusText = live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus) ? '' : ` (${newState.status})`;
        let scorerText = "";
        
        if (newGoalsList.length > 0) {
            const sortedGoals = [...newGoalsList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
            const latest = sortedGoals[0];
            const player = latest.player || latest.playerName || latest.name || "Unknown Player";
            const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
            scorerText = `\n⚽ GOAL - ${player} (${time.trim()})\n`;
        } 
        if (!scorerText.trim()) scorerText = `\n⚽ GOAL - Confirmed! Tap the link below for full details! 👇\n`;

        if (['PEN', 'PEN_SHOOT_OUT'].includes(newStatus)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
            payload.xMessage = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}\n\n${hashtags}`;
            payload.xImageUrl = getMatchImageUrl('PENALTY SCORED', newState, frontendUrl);
        } else {
            payload.fb1Message = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl}`;
            payload.xMessage = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n👇\n${matchUrl}\n\n${hashtags}`;
            payload.xImageUrl = getMatchImageUrl('GOAL ALERT!', newState, frontendUrl); 
        }
    } 
    // 🟢 3. PENALTY AWARDED
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        const time = sortedPens[0].time || sortedPens[0].minute ? `${sortedPens[0].time || sortedPens[0].minute}'` : '';
        payload.fb1Message = `⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}`;
    }
    // 🟢 4. LINEUPS (FB1 and X Image attached!)
    else if (oldWasIncomplete && newIsComplete) {
        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\n👇 See the tactical setup & subs here!\n${matchUrl}`;
        payload.xMessage = `🚨 STARTING XI: ${newState.home_team} vs ${newState.away_team}! 👇\n${matchUrl}\n\n${hashtags}`;
        
        const lineupOg = { 
            type: 'pitch', label: 'STARTING XI', 
            home: newState.home_team, away: newState.away_team, 
            homeFormation: newState.lineups?.formations?.home || '4-3-3',
            awayFormation: newState.lineups?.formations?.away || '4-3-3',
            homeXI: newValidH.slice(0, 11), awayXI: newValidA.slice(0, 11)
        };
        const finalUrl = `${frontendUrl}/api/og?data=${encodeBase64Safe(lineupOg)}`;
        
        payload.xImageUrl = finalUrl;
        payload.fb1ImageUrl = finalUrl; 
    } 
    else if (oldWasIncomplete && !newIsComplete && (newValidH.length > 0 || newValidA.length > 0)) {
        return NextResponse.json({ message: "Lineups still incomplete." });
    } 
    // 🟢 5. KICK OFF (FB1 and X Image attached!)
    else if (preStatuses.includes(oldStatus) && live1HStatuses.includes(newStatus)) {
        payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl}`;
        payload.xMessage = `⏱️ KICK-OFF!\n\nWe are officially underway.\n\n👇 Live updates:\n${matchUrl}\n\n${hashtags}`;
        
        const kickoffUrl = getMatchImageUrl('KICK-OFF', newState, frontendUrl);
        payload.xImageUrl = kickoffUrl;
        payload.fb1ImageUrl = kickoffUrl; 
    }
    // 🟢 6. HALF TIME
    else if (!htStatuses.includes(oldStatus) && htStatuses.includes(newStatus)) {
        payload.fb1Message = `⏸️ HALF TIME.\n\nHow do you rate the first half performance?\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇 Match Stats so far:\n${matchUrl}`;
    }
    // 🟢 7. SECOND HALF
    else if (htStatuses.includes(oldStatus) && (live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus))) {
        payload.fb1Message = `⏱️ SECOND HALF KICK-OFF!\n\nWe are back underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow the action here:\n👇\n${matchUrl}`;
    }
    // 🟢 8. FULL TIME (FB1 and X Image attached!)
    else if (!strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl}`;
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}.\n\n👇 Stats:\n${matchUrl}\n\n${hashtags}`;
        
        const ftUrl = getMatchImageUrl('FULL TIME', newState, frontendUrl);
        payload.xImageUrl = ftUrl;
        payload.fb1ImageUrl = ftUrl; 
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    // ===================================================================
    // 🟢 THE FIX: PRE-WARM THE CACHE BEFORE PINGING MAKE.COM
    // ===================================================================
    // Extract any unique image URLs from the payload
    const rawUrls = [payload.xImageUrl, payload.fb1ImageUrl].filter(Boolean) as string[];
const urlsToWarm = rawUrls.filter((url, index) => rawUrls.indexOf(url) === index);
    
    if (urlsToWarm.length > 0) {
        try {
            // We 'await' this so the server pauses until Cloudflare has successfully built and cached the image
            await Promise.all(urlsToWarm.map(url => fetch(url)));
        } catch (e) {
            console.error("Cache pre-warm failed, but proceeding anyway...", e);
        }
    }
    // ===================================================================

    // NOW ping Make.com. Buffer will fetch the image and get it instantly from cache.
    await postToSocials(payload);

    try {
        await fetch(`${frontendUrl}/api/index-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
            body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' })
        });
    } catch (e) {}

    return NextResponse.json({ success: true, event: "Webhook complete" });
}