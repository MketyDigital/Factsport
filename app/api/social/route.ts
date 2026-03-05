export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isBigTeamMatch, postToSocials, SocialPayload } from '@/app/lib/socialService';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized intruder' }, { status: 401 });
    }

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] } };

    if (!newState) return NextResponse.json({ message: "No record found" });

    let isVIP = isBigTeamMatch(newState.home_team, newState.away_team);

    // 🟢 THE FALLBACK LOGIC
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
            const fallbackMatchId = todaysMatches[0].id;
            if (newState.id === fallbackMatchId) {
                isVIP = true; 
            } else {
                return NextResponse.json({ message: "Not the chosen fallback match. Ignoring." });
            }
        }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://factsport.com';
    const matchUrl = `${baseUrl}/match/${newState.id}`; 
    
    let payload: SocialPayload = { link: matchUrl };

    // ⚽ DETECT GOALS (FB1 Only)
    if (newState.home_score > oldState.home_score || newState.away_score > oldState.away_score) {
        let statusText = ['IN_PLAY', 'LIVE'].includes(newState.status) ? '' : ` (${newState.status})`;
        payload.fb1Message = `🚨 GOAL!\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}`;
        
        if (newState.status === 'PEN') {
            payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}`;
        }
    }
    // 📋 DETECT LINEUPS (FB1 Text + X Graphic)
    else if (oldState.status === 'PRE_MATCH' && (!oldState.lineups?.home || oldState.lineups.home.length === 0) && newState.lineups?.home?.length > 0) {
        payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\nHome XI: ${newState.lineups.home.join(', ')}\n\nAway XI: ${newState.lineups.away.join(', ')}`;
        payload.xMessage = `🚨 TEAM NEWS IS IN!\n\nA massive clash ahead: ${newState.home_team} vs ${newState.away_team}. Full lineups and bench here:`;
        payload.xImageUrl = `${baseUrl}/api/og?key=${process.env.CRON_KEY}&type=versus&label=STARTING%20XI&home=${encodeURIComponent(newState.home_team)}&away=${encodeURIComponent(newState.away_team)}&homeLogo=${encodeURIComponent(newState.home_logo || '')}&awayLogo=${encodeURIComponent(newState.away_logo || '')}`;
    }
    // ⏸️ DETECT HALF TIME (FB1 Only)
    else if (oldState.status !== 'HT' && newState.status === 'HT') {
        payload.fb1Message = `⏸️ Half-Time whistle blows.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nTap in for live match stats and second-half updates.`;
    }
    // ⏹️ DETECT FULL TIME (FB1 Text + X Graphic)
    else if (!['FT', 'FINISHED', 'AET', 'AWARDED'].includes(oldState.status) && ['FT', 'FINISHED', 'AET', 'AWARDED'].includes(newState.status)) {
        const timeNote = newState.status === 'AET' ? ' (After Extra Time)' : (newState.status === 'PEN' ? ' (After Penalties)' : '');
        payload.fb1Message = `⏹️ FULL TIME!${timeNote}\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now.`;
        payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}. Rate the performance out of 10!`;
        payload.xImageUrl = `${baseUrl}/api/og?key=${process.env.CRON_KEY}&type=versus&label=FULL%20TIME&home=${encodeURIComponent(newState.home_team)}&away=${encodeURIComponent(newState.away_team)}&hScore=${newState.home_score}&aScore=${newState.away_score}&homeLogo=${encodeURIComponent(newState.home_logo || '')}&awayLogo=${encodeURIComponent(newState.away_logo || '')}`;
    }
    
    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "No postable event occurred." });

    await postToSocials(payload);
    
    return NextResponse.json({ success: true, event: "Posted successfully" });
}