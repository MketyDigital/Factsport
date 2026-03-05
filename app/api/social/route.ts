export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials } from '@/app/lib/socialService';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized intruder' }, { status: 401 });
    }

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH' };

    if (!newState) return NextResponse.json({ message: "No record found" });

    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);

    // 🟢 FALLBACK LOGIC: Pick one match if no VIPs play today
    if (!isVIP) {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const today = new Date().toISOString().split('T')[0];
        
        const { data: todaysMatches } = await supabase
            .from('matches')
            .select('id, home_team, away_team')
            .like('match_date', `${today}%`)
            .order('match_date', { ascending: true });

        const hasVIPToday = todaysMatches?.some(m => isBigTeamMatch(m.home_team, m.away_team));

        if (hasVIPToday) {
            return NextResponse.json({ message: "Not a VIP team, and big games are on today. Ignoring." });
        } else if (todaysMatches && todaysMatches.length > 0) {
            const fallbackMatchId = todaysMatches[0].id; // Pick the first match of the day
            if (newState.id === fallbackMatchId) {
                isVIP = true;
            } else {
                return NextResponse.json({ message: "Not the chosen fallback match. Ignoring." });
            }
        }
    }

    const matchUrl = `https://factsport.com/match/${newState.id}`; 
    let fbMessageToPost = "";
    let xMessageToPost = "";

    // ⚽ DETECT GOALS
    if (newState.home_score > oldState.home_score || newState.away_score > oldState.away_score) {
        let statusText = ['IN_PLAY', 'LIVE'].includes(newState.status) ? '' : ` (${newState.status})`;
        const text = `🚨 GOAL!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}`;
        fbMessageToPost = text;
        xMessageToPost = text;
    }
    // 📋 DETECT LINEUPS (Handling X limit vs FB length)
    else if (oldState.status === 'PRE_MATCH' && newState.lineups?.home?.length > 0) {
        fbMessageToPost = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome XI: ${newState.lineups.home.join(', ')}\n\nAway XI: ${newState.lineups.away.join(', ')}`;
        xMessageToPost = `📋 STARTING XI ANNOUNCED!\n\n⚽ ${newState.home_team} vs ${newState.away_team}\n\nTap the link below to see the full lineups!`;
    }
    // ⏹️ DETECT FULL TIME
    else if (!['FT', 'FINISHED'].includes(oldState.status) && ['FT', 'FINISHED'].includes(newState.status)) {
        const text = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nGet the full post-match stats on FactSport.`;
        fbMessageToPost = text;
        xMessageToPost = text;
    }
    
    if (!fbMessageToPost) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(fbMessageToPost, xMessageToPost, matchUrl);
    
    return NextResponse.json({ success: true, event: "Posted successfully" });
}