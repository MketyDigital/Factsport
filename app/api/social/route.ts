export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

// 🟢 TRUTH FILTER: Kills bad data before it processes
const getValidGoals = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        const text = String(e.text || e.description || '').toLowerCase();
        const type = String(e.type || e.detail || '').toLowerCase();
        
        if (text.includes('attempt saved') || 
            text.includes('missed') || 
            text.includes('disallowed') || 
            text.includes('cancelled') || 
            text.includes('no goal')) return false;
            
        return type === 'goal' || type === 'penalty' || text.includes('goal') || text.includes('⚽');
    });
};

// 🟢 STOPPAGE TIME FIX: Converts "45+3'" into 453 for perfect sorting
const parseTime = (t: any) => parseInt(String(t).replace(/[^0-9]/g, '')) || 0;

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };

    if (!newState) return NextResponse.json({ message: "No record found" });
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

    if (newTotal < oldTotal) {
        payload.fb1Message = `🚫 GOAL DISALLOWED!\n\nVAR decision: The previous goal has been overturned. The score returns to:\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
    }
    else if (newTotal > oldTotal) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let matchEvents = newState.match_events || [];
        let newGoals = getValidGoals(matchEvents);

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
            const sortedGoals = [...newGoals].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
            const latest = sortedGoals[0];
            const rich = latest.text || latest.description || "";
            const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
            
            const dbScore = `${newState.home_score}-${newState.away_score}`;
            const isStaleText = rich.includes('-') && !rich.includes(dbScore) && !rich.includes(`${newState.home_score}, ${newState.away_score}`);

            if (rich && !isStaleText) {
                scorerText = `\n${rich.includes(time.trim()) ? '' : time}${rich}\n`;
            } else {
                const player = latest.player || latest.playerName || latest.name;
                if (player) scorerText = `\n🎯 ${player} (${time.trim()})\n`;
            }
        } 
        
        if (!scorerText.trim()) scorerText = `\n⚽ Goal confirmed! Tap the link below for full details and stats! 👇\n`;

        if (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
        } else {
            payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl} ⚽`;
        }
    }
    else {
        const oldLine = Array.isArray(oldState.lineups?.home) && oldState.lineups.home.length > 0;
        const newLine = Array.isArray(newState.lineups?.home) && newState.lineups.home.length > 0 && Array.isArray(newState.lineups?.away) && newState.lineups.away.length > 0;
        
        if (!oldLine && newLine) {
            const hNames = newState.lineups.home.map((p: any) => p?.name || (typeof p === 'string' ? p : null)).filter(Boolean);
            const aNames = newState.lineups.away.map((p: any) => p?.name || (typeof p === 'string' ? p : null)).filter(Boolean);
            
            if (hNames.length >= 11 && aNames.length >= 11) {
                const hXI = hNames.slice(0, 11).join(', ');
                const aXI = aNames.slice(0, 11).join(', ');
                payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome: ${hXI}\n\nAway: ${aXI}\n\n👇\n${matchUrl} ⚽`;
                payload.xMessage = `🚨 TEAM NEWS IS IN!\n\n${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
                const lineupOg = { type: 'versus', label: 'STARTING XI', home: newState.home_team, away: newState.away_team, homeXI: hXI, awayXI: aXI };
                const lineupBase64 = encodeURIComponent(Buffer.from(JSON.stringify(lineupOg)).toString('base64'));
                payload.xImageUrl = `${imageUrl}/api/og?data=${lineupBase64}&ext=.png`;
            } else {
                payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\nThe team sheets are in for ${newState.home_team} vs ${newState.away_team}!\n\nTap the link below to see the confirmed lineups before kick-off! 👇\n${matchUrl} ⚽`;
                payload.xMessage = `🚨 TEAM NEWS IS IN!\n\n${newState.home_team} vs ${newState.away_team}. Tap below to view the confirmed starting XI!`;
                const safeOg = { type: 'versus', label: 'TEAM NEWS', home: newState.home_team, away: newState.away_team };
                const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(safeOg)).toString('base64'));
                payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
            }
        }
        else if (['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS'].includes(oldState.status) && ['IN_PLAY', 'LIVE', '1H'].includes(newState.status)) {
            payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl} ⚽`;
        }
        else if (oldState.status !== 'HT' && newState.status === 'HT') {
            payload.fb1Message = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
        }
        else if (!['FT', 'FINISHED'].includes(oldState.status) && ['FT', 'FINISHED'].includes(newState.status)) {
            payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl} ⚽`;
            payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance!`;
            const ftOg = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score };
            const ftBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ftOg)).toString('base64'));
            payload.xImageUrl = `${imageUrl}/api/og?data=${ftBase64}&ext=.png`;
        }
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });
    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Webhook complete" });
}