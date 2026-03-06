export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

// 🟢 HELPER: THE TRUTH FILTER
const getValidGoals = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        const typeStr = String(e.type || e.detail || '').trim().toLowerCase();
        const textStr = String(e.text || e.description || e.comment || e.comments || '').toLowerCase();

        // ❌ BAN LIST: No "Saved", "Missed", or "VAR Disallowed" text as a Goal Alert
        if (textStr.includes('attempt saved') || 
            textStr.includes('missed penalty') || 
            textStr.includes('goal disallowed') || 
            textStr.includes('cancelled') || 
            (textStr.includes('var') && textStr.includes('no goal')) ||
            textStr.includes('attempt missed')) return false;
        
        // ✅ ALLOW LIST
        if (typeStr === 'goal' || typeStr === 'penalty') return true;
        if (textStr.startsWith('goal ') || textStr.startsWith('goal!') || textStr.includes('⚽')) return true;
        
        return false;
    });
};

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };

    if (!newState) return NextResponse.json({ message: "No record found" });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // --- VIP & FALLBACK LOGIC ---
    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);
    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => isBigTeamMatch(m.home_team, m.away_team));
        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team." });
        if (todaysMatches?.[0]?.id === newState.id) isVIP = true;
        else return NextResponse.json({ message: "Skipping non-VIP/non-fallback match." });
    }

    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    
    // 🟢 INITIALIZE PAYLOAD HERE (Fixes the "Cannot find name 'payload'" error)
    let payload: SocialPayload = {}; 

    const oldTotal = (oldState.home_score || 0) + (oldState.away_score || 0);
    const newTotal = (newState.home_score || 0) + (newState.away_score || 0);

    // 🔴 1. VAR CHECK: If score decreased (Goal disallowed)
    if (newTotal < oldTotal) {
        payload.fb1Message = `🚫 GOAL DISALLOWED!\n\nVAR decision: The previous goal has been overturned. The score returns to:\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
    }
    // 🟢 2. GOAL/PENALTY CHECK: If score increased
    else if (newTotal > oldTotal) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let matchEvents = newState.match_events || [];
        let newGoals = getValidGoals(matchEvents);

        // 4.5s Patience Loop for Rich Commentary
        if (newGoals.length < newTotal) {
            await new Promise(resolve => setTimeout(resolve, 4500));
            const { data: fresh } = await supabase.from('matches').select('match_events').eq('id', newState.id).single();
            if (fresh?.match_events) { 
                matchEvents = fresh.match_events; 
                newGoals = getValidGoals(matchEvents); 
            }
        }

        let scorerText = "";
        if (newGoals.length === newTotal) {
            const latest = newGoals[newGoals.length - 1];
            if (typeof latest === 'string') scorerText = `\n${latest}\n`;
            else {
                const rich = latest.text || latest.description || latest.comment || "";
                if (rich) {
                    const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
                    scorerText = `\n${rich.includes(time.trim()) ? '' : time}${rich}\n`;
                } else {
                    const player = latest.player || latest.playerName || latest.name;
                    const time = latest.time || latest.minute || "";
                    if (player) scorerText = `\n🎯 ${player} ${time ? `(${time}')` : ''}\n`;
                }
            }
        }
        
        if (!scorerText.trim()) scorerText = `\n⚽ Goal confirmed! Tap the link below for full scorer details and assists! 👇\n`;

        // Specialized Penalty Shootout Text
        if (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
        } else {
            payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl} ⚽`;
        }
    }
    // 🟢 3. KICK-OFF
    else if (['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS'].includes(oldState.status) && ['IN_PLAY', 'LIVE', '1H'].includes(newState.status)) {
        payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl} ⚽`;
    }
    // 🟢 4. HALF TIME
    else if (!['HT', 'HALFTIME', 'HALF_TIME'].includes(oldState.status) && ['HT', 'HALFTIME', 'HALF_TIME'].includes(newState.status)) {
        payload.fb1Message = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nTap in for stats and ratings:\n👇\n${matchUrl} ⚽`;
    }
    // 🟢 5. FULL TIME
    else if (!['FT', 'FINISHED'].includes(oldState.status) && ['FT', 'FINISHED'].includes(newState.status)) {
        payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl} ⚽`;
        
        // Full-time also gets an X post with an OG image
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance out of 10!`;
        const ogPayload = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }
    // 🟢 6. LINEUPS (Added back in for completeness)
    const oldHasBothLineups = Array.isArray(oldState.lineups?.home) && oldState.lineups.home.length > 0 && Array.isArray(oldState.lineups?.away) && oldState.lineups.away.length > 0;
    const newHasBothLineups = Array.isArray(newState.lineups?.home) && newState.lineups.home.length > 0 && Array.isArray(newState.lineups?.away) && newState.lineups.away.length > 0;
    
    if (!oldHasBothLineups && newHasBothLineups) {
        const homeXI = newState.lineups.home.slice(0, 11).join(', ');
        const awayXI = newState.lineups.away.slice(0, 11).join(', ');
        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome XI: ${homeXI}\n\nAway XI: ${awayXI}\n\n👇\n${matchUrl} ⚽`;
        payload.xMessage = `🚨 TEAM NEWS IS IN!\n\nA massive clash ahead: ${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
        const ogPayload = { type: 'versus', label: 'STARTING XI', home: newState.home_team, away: newState.away_team, homeXI, awayXI };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event." });
    
    await postToSocials(payload);
    return NextResponse.json({ success: true });
}