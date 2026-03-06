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

    const frontendUrl = 'https://factsport.com'; 
    const imageUrl = 'https://factsport.vercel.app'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    let payload: SocialPayload = {}; 

    if (newState.home_score > oldState.home_score || newState.away_score > oldState.away_score) {
        let statusText = ['IN_PLAY', 'LIVE', '1H', '2H'].includes(newState.status) ? '' : ` (${newState.status})`;
        let scorerText = "";
        if (newState.match_events && Array.isArray(newState.match_events)) {
            const goals = newState.match_events.filter((e: any) => e.type === 'goal');
            if (goals.length > 0) scorerText = `\n🎯 ${goals[goals.length - 1].player} - ${goals[goals.length - 1].time}'\n`;
        }
        payload.fb1Message = `🚨 GOAL ALERT!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\nTap in for full live match updates:\n👇\n${matchUrl} ⚽`;
        if (newState.status === 'PEN') payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl} ⚽`;
    }
    else if (oldState.status === 'PRE_MATCH' && ['IN_PLAY', 'LIVE', '1H'].includes(newState.status)) {
        payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates, stats, and scores here:\n👇\n${matchUrl} ⚽`;
    }
    else if (oldState.status === 'PRE_MATCH' && (!oldState.lineups?.home || oldState.lineups.home.length === 0) && newState.lineups?.home?.length > 0) {
        const homeXI = newState.lineups.home.slice(0, 11).join(',');
        const awayXI = newState.lineups.away.slice(0, 11).join(',');

        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome XI: ${newState.lineups.home.join(', ')}\n\nAway XI: ${newState.lineups.away.join(', ')}\n\n👇\n${matchUrl} ⚽`;
        payload.xMessage = `🚨 TEAM NEWS IS IN!\n\nA massive clash ahead: ${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
        
        // 🔒 BASE64 ENCRYPTION
        const ogPayload = { type: 'versus', label: 'STARTING XI', home: newState.home_team, away: newState.away_team, homeXI, awayXI };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }
    else if (oldState.status !== 'HT' && newState.status === 'HT') {
        payload.fb1Message = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nTap in for live match stats and second-half updates:\n\n👇\n${matchUrl} ⚽`;
    }
    else if (!['FT', 'FINISHED', 'AET', 'AWARDED'].includes(oldState.status) && ['FT', 'FINISHED', 'AET', 'AWARDED'].includes(newState.status)) {
        const timeNote = newState.status === 'AET' ? ' (After Extra Time)' : (newState.status === 'PEN' ? ' (After Penalties)' : '');
        payload.fb1Message = `⏹️ FULL TIME!${timeNote}\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n\n👇\n${matchUrl} ⚽`;
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance out of 10!`;
        
        // 🔒 BASE64 ENCRYPTION
        const ogPayload = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score };
        const safeBase64 = encodeURIComponent(Buffer.from(JSON.stringify(ogPayload)).toString('base64'));
        payload.xImageUrl = `${imageUrl}/api/og?data=${safeBase64}&ext=.png`;
    }
    
    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(payload);
    return NextResponse.json({ success: true, event: "Posted successfully" });
}