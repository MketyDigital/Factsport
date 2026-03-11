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

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };
    if (!newState) return NextResponse.json({ message: "No record found" });

    // 🛑 ANTI-GHOST POST FILTER
    // If it was already FT/FINISHED, block late corrections. Allows PEN, AET, IN_PLAY to post freely!
    const strictlyFinishedStatuses = ['FT', 'FINISHED', 'ABD'];
    if (strictlyFinishedStatuses.includes(oldState.status) && strictlyFinishedStatuses.includes(newState.status)) {
        console.log(`[Webhook] Match ${newState.id} is already finished. Ignoring late correction.`);
        return NextResponse.json({ message: "Match already finished. Ignoring late correction for socials." });
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
    const imageUrl = 'https://factsport.vercel.app'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
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

    // 1. VAR DISALLOWED
    if (newTotal < oldTotal) {
        payload.fb1Message = `❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
    } 
    // 2. GOAL / PENALTY SCORED
    else if (newTotal > oldTotal || newGoalsList.length > oldGoalsList.length) {
        if (newGoalsList.length < newTotal) return NextResponse.json({ message: "Facts data lagging behind scoreboard. Waiting for next ping." });
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let scorerText = "";
        
        if (newGoalsList.length > 0) {
            const sortedGoals = [...newGoalsList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
            const latest = sortedGoals[0];
            const player = latest.player || latest.playerName || latest.name || "Unknown Player";
            const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
            scorerText = `\n⚽ GOAL - ${player} (${time.trim()})\n`;
        } 
        if (!scorerText.trim()) scorerText = `\n⚽ GOAL - Confirmed! Tap the link below for full details and stats! 👇\n`;

        if (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
        } else {
            payload.fb1Message = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl}`;
        }
    } 
    // 3. PENALTY AWARDED
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        const latestPen = sortedPens[0];
        const time = latestPen.time || latestPen.minute ? `${latestPen.time || latestPen.minute}'` : '';
        payload.fb1Message = `⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}`;
    }
    // 4. STARTING XI 
    else if (oldWasIncomplete && newIsComplete) {
        const hXI = newValidH.slice(0, 11).join(', '); const aXI = newValidA.slice(0, 11).join(', ');
        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome: ${hXI}\n\nAway: ${aXI}\n\n👇\n${matchUrl}`;
        payload.xMessage = `🚨 TEAM NEWS IS IN!\n\nA massive clash ahead: ${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
        const lineupOg = { type: 'versus', label: 'STARTING XI', home: newState.home_team, away: newState.away_team, homeXI: hXI, awayXI: aXI };
        const lineupBase64 = encodeURIComponent(Buffer.from(JSON.stringify(lineupOg)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${lineupBase64}&ext=.png`;
    } 
    else if (oldWasIncomplete && !newIsComplete && (newValidH.length > 0 || newValidA.length > 0)) {
        return NextResponse.json({ message: "Lineups still incomplete." });
    } 
    // 5. MATCH STATUS UPDATES
    else if (['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS'].includes(oldState.status) && ['IN_PLAY', 'LIVE', '1H'].includes(newState.status)) {
        payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl}`;
    }
    else if (oldState.status !== 'HT' && newState.status === 'HT') {
        payload.fb1Message = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
    }
    else if (!['FT', 'FINISHED'].includes(oldState.status) && ['FT', 'FINISHED'].includes(newState.status)) {
        payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl}`;
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance!`;
        const ftOg = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score };
        const ftBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ftOg)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${ftBase64}&ext=.png`;
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });
    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Webhook complete" });
}