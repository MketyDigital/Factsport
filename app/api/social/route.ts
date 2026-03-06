export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

// 🟢 HELPER: Safely counts valid goals to prevent "Attempt saved" bugs
const getValidGoals = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        const typeStr = String(e.type || e.detail || '').trim().toLowerCase();
        const textStr = String(e.text || e.description || e.comment || e.comments || '');
        if (textStr.includes('Attempt saved') || textStr.includes('Missed penalty') || textStr.includes('Attempt missed')) return false;
        if (typeStr === 'goal' || typeStr === 'penalty') return true;
        if (textStr.startsWith('Goal ') || textStr.startsWith('Goal!') || textStr.includes('⚽')) return true;
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
    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);

    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => isBigTeamMatch(m.home_team, m.away_team));

        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team." });
        else if (todaysMatches && todaysMatches.length > 0) {
            if (newState.id === todaysMatches[0].id) isVIP = true; 
            else return NextResponse.json({ message: "Not the fallback match." });
        }
    }

    const oldHasBothLineups = Array.isArray(oldState.lineups?.home) && oldState.lineups.home.length > 0 && Array.isArray(oldState.lineups?.away) && oldState.lineups.away.length > 0;
    const newHasBothLineups = Array.isArray(newState.lineups?.home) && newState.lineups.home.length > 0 && Array.isArray(newState.lineups?.away) && newState.lineups.away.length > 0;

    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    let payload: SocialPayload = {}; 

    const scoreIncreased = (newState.home_score + newState.away_score) > (oldState.home_score + oldState.away_score);
    let matchEvents = newState.match_events;
    let newGoals = getValidGoals(matchEvents);

    // 🟢 1. GOALS & SCORERS (The Patience Pattern)
    if (scoreIncreased) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        
        // 🔥 MICRO-DELAY LOGIC: If the score went up but the commentary event isn't in the array yet
        if (newGoals.length < (newState.home_score + newState.away_score)) {
            console.log("⏳ API Lag detected. Waiting 4 seconds to grab rich text...");
            // We wait exactly 4 seconds. This is the "Safe Zone" for Vercel Edge functions.
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            // We reach out to Supabase to get a "Fresh" look at the database 4 seconds later
            const { data: freshMatch } = await supabase.from('matches').select('match_events').eq('id', newState.id).single();
            if (freshMatch && freshMatch.match_events) {
                matchEvents = freshMatch.match_events;
                newGoals = getValidGoals(matchEvents);
            }
        }

        let scorerText = "";
        
        if (newGoals.length > 0) {
            // SUCCESS: We have the goal event now.
            const latestGoal = newGoals[newGoals.length - 1];
            if (typeof latestGoal === 'string') {
                scorerText = `\n${latestGoal}\n`;
            } else {
                const richText = latestGoal.text || latestGoal.description || latestGoal.comment || latestGoal.comments || latestGoal.detail || "";
                if (richText) {
                    const timeStr = latestGoal.time || latestGoal.minute ? `${latestGoal.time || latestGoal.minute}' ` : '';
                    const prefix = richText.includes(String(latestGoal.time)) ? '' : timeStr;
                    scorerText = `\n${prefix}${richText}\n`;
                } else {
                    const player = latestGoal.player || latestGoal.playerName || latestGoal.name || "Goalscorer";
                    const time = latestGoal.time || latestGoal.minute || "";
                    const assist = latestGoal.assist || latestGoal.assist_name || latestGoal.assistName;
                    scorerText = `\n🎯 ${player} ${time ? `(${time}')` : ''}`;
                    if (assist) scorerText += `\n🤝 Assist: ${assist}`;
                    scorerText += `\n`;
                }
            }
        } else {
            // 🚨 FINAL FALLBACK: 4 seconds passed and still no event. 
            // We post the score immediately to keep the site "Live" but ask users to check the link for details.
            scorerText = `\n⚽ Goal confirmed! Scorer details updating...\nCheck live updates and assists here: 👇\n`;
        }
        
        payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl} ⚽`;
        
        if (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
        }
    }
    // 🟢 2. KICK-OFF
    else if (['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'TBD'].includes(oldState.status) && ['IN_PLAY', 'LIVE', '1H'].includes(newState.status)) {
        payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates, stats, and scores here:\n👇\n${matchUrl} ⚽`;
    }
    // 🟢 3. LINEUPS
    else if (!oldHasBothLineups && newHasBothLineups) {
        const homeXI = newState.lineups.home.slice(0, 11).join(', ');
        const awayXI = newState.lineups.away.slice(0, 11).join(', ');

        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome XI: ${homeXI}\n\nAway XI: ${awayXI}\n\n👇\n${matchUrl} ⚽`;
        payload.xMessage = `🚨 TEAM NEWS IS IN!\n\nA massive clash ahead: ${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
        
        const ogPayload = { type: 'versus', label: 'STARTING XI', home: newState.home_team, away: newState.away_team, homeXI, awayXI };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }
    // 🟢 4. HALF TIME
    else if (!['HT', 'HALFTIME', 'HALF_TIME'].includes(oldState.status) && ['HT', 'HALFTIME', 'HALF_TIME'].includes(newState.status)) {
        payload.fb1Message = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nTap in for live match stats and second-half updates:\n\n👇\n${matchUrl} ⚽`;
    }
    // 🟢 5. FULL TIME
    else if (!['FT', 'FINISHED', 'AET', 'AWARDED', 'FULL_TIME'].includes(oldState.status) && ['FT', 'FINISHED', 'AET', 'AWARDED', 'FULL_TIME'].includes(newState.status)) {
        const timeNote = newState.status === 'AET' ? ' (After Extra Time)' : (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status) ? ' (After Penalties)' : '');
        payload.fb1Message = `⏹️ FULL TIME!${timeNote}\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n\n👇\n${matchUrl} ⚽`;
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance out of 10!`;
        
        const ogPayload = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }
    
    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Posted successfully" });
}