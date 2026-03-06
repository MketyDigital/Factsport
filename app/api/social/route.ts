export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

// 🟢 HELPER: The "Truth Filter" - Only accepts real goals, kills "Saved Attempts"
const getValidGoals = (eventsArr: any[]) => {
    if (!Array.isArray(eventsArr)) return [];
    return eventsArr.filter((e: any) => {
        if (!e) return false;
        
        const typeStr = String(e.type || e.detail || '').trim().toLowerCase();
        const textStr = String(e.text || e.description || e.comment || e.comments || '').toLowerCase();
        
        // ❌ THE BAN LIST: If these words appear, it is NOT a goal alert.
        if (textStr.includes('attempt saved') || 
            textStr.includes('missed penalty') || 
            textStr.includes('attempt missed') || 
            textStr.includes('blocked shot')) return false;
        
        // ✅ THE ALLOW LIST: Explicit Goal types or "Goal!" text
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
    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);

    // ... (VIP logic remains same)

    const scoreIncreased = (newState.home_score + newState.away_score) > (oldState.home_score + oldState.away_score);
    const totalScore = (newState.home_score || 0) + (newState.away_score || 0);

    if (scoreIncreased) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let matchEvents = newState.match_events || [];
        let newGoals = getValidGoals(matchEvents);

        // 🔥 STEP 1: If data is missing or mismatched, wait 4.5 seconds
        if (newGoals.length < totalScore) {
            await new Promise(resolve => setTimeout(resolve, 4500));
            
            // 🔥 STEP 2: FRESH FETCH
            const { data: freshMatch } = await supabase.from('matches').select('match_events').eq('id', newState.id).single();
            if (freshMatch && freshMatch.match_events) {
                matchEvents = freshMatch.match_events;
                newGoals = getValidGoals(matchEvents); // RE-CALCULATE TRUTH
            }
        }

        let scorerText = "";
        
        // 🔥 STEP 3: THE TRUTH CHECK
        // If goals in list exactly matches the score, we can trust the latest commentary.
        if (newGoals.length === totalScore) {
            const latestGoal = newGoals[newGoals.length - 1];
            if (typeof latestGoal === 'string') {
                scorerText = `\n${latestGoal}\n`;
            } else {
                const richText = latestGoal.text || latestGoal.description || latestGoal.comment || latestGoal.detail || "";
                if (richText) {
                    const timeStr = latestGoal.time || latestGoal.minute ? `${latestGoal.time || latestGoal.minute}' ` : '';
                    // Use rich text only if it actually looks like a goal description
                    scorerText = `\n${richText.includes(timeStr.trim()) ? '' : timeStr}${richText}\n`;
                } else {
                    const player = latestGoal.player || latestGoal.playerName || latestGoal.name;
                    const time = latestGoal.time || latestGoal.minute || "";
                    if (player) {
                        scorerText = `\n🎯 ${player} ${time ? `(${time}')` : ''}\n`;
                    }
                }
            }
        } 
        
        // If scorerText is still empty (API lag or missing data), we go to the Clean Fallback
        if (!scorerText.trim()) {
            scorerText = `\n⚽ Goal confirmed! Tap the link below for full details and stats! 👇\n`;
        }
        
        payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl} ⚽`;
        
        if (['PEN', 'PEN_SHOOT_OUT'].includes(newState.status)) {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
        }
    }
    // ... (Kick-off, Lineup, HT, FT logic)

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Posted successfully" });
}