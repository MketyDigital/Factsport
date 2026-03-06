export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] } };

    if (!newState) return NextResponse.json({ message: "No record found" });

    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);

    if (!isVIP) {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => isBigTeamMatch(m.home_team, m.away_team));

        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team." });
        else if (todaysMatches && todaysMatches.length > 0) {
            if (newState.id === todaysMatches[0].id) isVIP = true; 
            else return NextResponse.json({ message: "Not the fallback match." });
        }
    }

    const oldHasBothLineups = Array.isArray(oldState.lineups?.home) && oldState.lineups.home.length > 0 && 
                              Array.isArray(oldState.lineups?.away) && oldState.lineups.away.length > 0;
                              
    const newHasBothLineups = Array.isArray(newState.lineups?.home) && newState.lineups.home.length > 0 && 
                              Array.isArray(newState.lineups?.away) && newState.lineups.away.length > 0;

    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    let payload: SocialPayload = {}; 

    // 🟢 1. GOALS, SCORERS, AND ASSISTS (Now hunting for rich commentary!)
    if (newState.home_score > oldState.home_score || newState.away_score > oldState.away_score) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let scorerText = "";
        
        if (Array.isArray(newState.match_events)) {
            const goals = newState.match_events.filter((e: any) => 
                e && (typeof e === 'string' ? e.toLowerCase().includes('goal') : (e.type === 'goal' || e.type === 'penalty'))
            );
            
            if (goals.length > 0) {
                const latestGoal = goals[goals.length - 1];
                
                if (typeof latestGoal === 'string') {
                    scorerText = `\n${latestGoal}\n`;
                } else {
                    // 🔥 THE MAGIC CATCHER: Grabs the rich play-by-play text you saw in the app
                    const richText = latestGoal.text || latestGoal.description || latestGoal.comment || latestGoal.comments || latestGoal.detail;
                    
                    if (richText) {
                        // If the API provided the rich text (e.g., "⚽ Goal! Tottenham Hotspur 1..."), we use it directly!
                        // We check if time is already included in the text to avoid duplicating "45'+7' - 45'+7'"
                        const timeStr = latestGoal.time || latestGoal.minute ? `${latestGoal.time || latestGoal.minute}' ` : '';
                        const prefix = richText.includes(timeStr.trim()) ? '' : timeStr;
                        scorerText = `\n${prefix}${richText}\n`;
                    } else {
                        // Safe Fallback if the rich text doesn't exist
                        const player = latestGoal.player || latestGoal.playerName || latestGoal.name || "Goalscorer";
                        const time = latestGoal.time || latestGoal.minute || "";
                        const assist = latestGoal.assist || latestGoal.assist_name || latestGoal.assistName;
                        
                        scorerText = `\n🎯 ${player} ${time ? `(${time}')` : ''}`;
                        if (assist) scorerText += `\n🤝 Assist: ${assist}`;
                        scorerText += `\n`;
                    }
                }
            }
        }
        
        payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\nTap in for full live match updates:\n👇\n${matchUrl} ⚽`;
        
        // Shootout Override
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
    
    // 🟢 ABORT IF NOTHING HAPPENED
    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    // 🟢 FIRE!
    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Posted successfully" });
}