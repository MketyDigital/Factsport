export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials } from '@/app/lib/socialService';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized intruder' }, { status: 401 });
    }

    const body = await request.json();
    const oldState = body.old_record;
    const newState = body.record;

    if (!newState || !isBigTeamMatch(newState.home_team, newState.away_team)) {
        return NextResponse.json({ message: "Not a VIP team, ignoring." });
    }

    // 🟢 UPDATED: Points directly to your live production match page
    const matchUrl = `https://factsport.com/match/${newState.id}`; 
    let messageToPost = "";

    // ⚽ DETECT GOALS
    if (newState.home_score > oldState.home_score || newState.away_score > oldState.away_score) {
        let statusText = ['IN_PLAY', 'LIVE'].includes(newState.status) ? '' : ` (${newState.status})`;
        messageToPost = `🚨 GOAL!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}`;
        
        if (newState.status === 'PEN') {
            messageToPost = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}`;
        }
    }
    // ⏸️ DETECT HALF TIME
    else if (oldState.status !== 'HT' && newState.status === 'HT') {
        messageToPost = `⏸️ Half-Time whistle blows.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nTap in for live match stats and second-half updates.`;
    }
    // ⏹️ DETECT FULL TIME
    else if (!['FT', 'FINISHED', 'AET', 'AWARDED'].includes(oldState.status) && ['FT', 'FINISHED', 'AET', 'AWARDED'].includes(newState.status)) {
        const timeNote = newState.status === 'AET' ? ' (After Extra Time)' : (newState.status === 'PEN' ? ' (After Penalties)' : '');
        messageToPost = `⏹️ FULL TIME!${timeNote}\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nGet the full post-match breakdown, player ratings, and stats on FactSport.`;
    }
    // 📋 DETECT LINEUPS
    else if (!oldState.lineups?.home?.length && newState.lineups?.home?.length) {
        const homeStarters = newState.lineups.home.filter((p: any) => p.is_starter).map((p:any) => p.name).join(', ');
        const awayStarters = newState.lineups.away.filter((p: any) => p.is_starter).map((p:any) => p.name).join(', ');
        messageToPost = `📋 TEAM NEWS IS IN!\n\n🏠 ${newState.home_team} XI: ${homeStarters}\n\n✈️ ${newState.away_team} XI: ${awayStarters}\n\nTo see the full benches and tactical setups, hit the Match Center.`;
    }

    if (!messageToPost) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(messageToPost, matchUrl);
    
    return NextResponse.json({ success: true, event: "Posted successfully" });
}