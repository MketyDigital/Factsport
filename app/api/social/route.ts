export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { postToSocials, SocialPayload } from '@/app/lib/socialService';

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

const getMatchHashtag = (home: string, away: string, homeTla?: string, awayTla?: string) => {
    const cleanH = homeTla || home.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3);
    const cleanA = awayTla || away.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3);
    return `#${cleanH.toUpperCase()}${cleanA.toUpperCase()} #FactSportLive`;
};

// 🟢 CLOUDFLARE EDGE-SAFE ENCODER
function encodeBase64Safe(obj: any) {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 🟢 HELPER TO GENERATE MATCH IMAGES
const getMatchImageUrl = (label: string, state: any, baseUrl: string) => {
    const payload = { 
        type: 'versus', label: label, 
        home: state.home_team, away: state.away_team, 
        hScore: state.home_score, aScore: state.away_score,
        homeLogo: state.home_logo, awayLogo: state.away_logo
    };
    return `${baseUrl}/api/og?data=${encodeBase64Safe(payload)}`;
};

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };
    if (!newState) return NextResponse.json({ message: "No record found" });

    const oldStatus = String(oldState.status).toUpperCase();
    const newStatus = String(newState.status).toUpperCase();

    const strictlyFinishedStatuses = ['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED'];
    if (strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        return NextResponse.json({ message: "Match already finished. Ignoring late correction." });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // ===================================================================
    // 🟢 FETCH DYNAMIC ADMIN SETTINGS
    // ===================================================================
    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    
    // Safe Fallback defaults if the database is empty
    const config = settingsData?.social_config || {
        vip_teams: ['Arsenal', 'Chelsea', 'Liverpool', 'Man City', 'Man United', 'Tottenham', 'Barcelona', 'Real Madrid', 'Bayern', 'PSG', 'Juventus', 'Inter'],
        vip_leagues: ['World Cup', 'Euro Championship'],
        events: {
            goals: { fb: true, x: true },
            var_overturn: { fb: true, x: false },
            penalty_awarded: { fb: true, x: false },
            lineups: { fb: true, x: true },
            kickoff: { fb: true, x: true },
            halftime: { fb: true, x: false },
            fulltime: { fb: true, x: true }
        }
    };

    // Check VIP Status using the dynamic arrays
    const isVipTeam = config.vip_teams.includes(newState.home_team) || config.vip_teams.includes(newState.away_team);
    const isVipLeague = config.vip_leagues.includes(newState.league);
    let isVIP = isVipTeam || isVipLeague;
    
    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team, league').like('match_date', `${today}%`).order('match_date', { ascending: true });
        
        // Check if ANY match today is a VIP match
        const hasVIPToday = todaysMatches?.some(m => config.vip_teams.includes(m.home_team) || config.vip_teams.includes(m.away_team) || config.vip_leagues.includes(m.league));
        
        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team or league." });
        if (todaysMatches && todaysMatches.length > 0 && newState.id === todaysMatches[0].id) isVIP = true; // Fallback
        else return NextResponse.json({ message: "Not the fallback match." });
    }
    // ===================================================================

    const frontendUrl = 'https://factsport.com'; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    const hashtags = getMatchHashtag(newState.home_team, newState.away_team, newState.home_tla, newState.away_tla); 
    
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

    const preStatuses = ['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD'];
    const live1HStatuses = ['IN_PLAY', 'LIVE', '1H', 'FIRST_HALF', 'FIRST HALF'];
    const htStatuses = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME', 'PAUSED'];
    const live2HStatuses = ['2H', 'SECOND_HALF', 'SECOND HALF'];

    // 🟢 1. VAR DECISIONS
    if (newTotal < oldTotal) {
        if (config.events.var_overturn.fb) {
            payload.fb1Message = `❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
        }
        if (config.events.var_overturn.x) {
            payload.xMessage = `❌ VAR DECISION: OVERTURNED - Previous G/Event canceled.\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}\n\n${hashtags}`;
        }
    } 
    // 🟢 2. GOALS 
    else if (newTotal > oldTotal || newGoalsList.length > oldGoalsList.length) {
        if (newGoalsList.length < newTotal) return NextResponse.json({ message: "Facts data lagging behind scoreboard. Waiting for next ping." });
        let statusText = live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus) ? '' : ` (${newState.status})`;
        let scorerText = "";
        
        if (newGoalsList.length > 0) {
            const sortedGoals = [...newGoalsList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
            const latest = sortedGoals[0];
            const player = latest.player || latest.playerName || latest.name || "Unknown Player";
            const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
            scorerText = `\n⚽ GOAL - ${player} (${time.trim()})\n`;
        } 
        if (!scorerText.trim()) scorerText = `\n⚽ GOAL - Confirmed! Tap the link below for full details! 👇\n`;

        if (['PEN', 'PEN_SHOOT_OUT'].includes(newStatus)) {
            if (config.events.goals.fb) {
                payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
            }
            if (config.events.goals.x) {
                payload.xMessage = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}\n\n${hashtags}`;
                payload.xImageUrl = getMatchImageUrl('PENALTY SCORED', newState, frontendUrl);
            }
        } else {
            if (config.events.goals.fb) {
                payload.fb1Message = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl}`;
            }
            if (config.events.goals.x) {
                payload.xMessage = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n👇\n${matchUrl}\n\n${hashtags}`;
                payload.xImageUrl = getMatchImageUrl('GOAL ALERT!', newState, frontendUrl); 
            }
        }
    } 
    // 🟢 3. PENALTY AWARDED
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        const time = sortedPens[0].time || sortedPens[0].minute ? `${sortedPens[0].time || sortedPens[0].minute}'` : '';
        
        if (config.events.penalty_awarded.fb) {
            payload.fb1Message = `⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}`;
        }
        if (config.events.penalty_awarded.x) {
            payload.xMessage = `⚠️ PENALTY AWARDED - ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}\n\n${hashtags}`;
        }
    }
    // 🟢 4. LINEUPS
    else if (oldWasIncomplete && newIsComplete) {
        if (config.events.lineups.fb) {
            payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\n👇 See the tactical setup & subs here!\n${matchUrl}`;
        }
        if (config.events.lineups.x) {
            payload.xMessage = `🚨 STARTING XI: ${newState.home_team} vs ${newState.away_team}! 👇\n${matchUrl}\n\n${hashtags}`;
        }
        
        // Generate Image only if at least one platform wants it
        if (config.events.lineups.fb || config.events.lineups.x) {
            const lineupOg = { 
                type: 'pitch', label: 'STARTING XI', 
                home: newState.home_team, away: newState.away_team, 
                homeFormation: newState.lineups?.formations?.home || '4-3-3',
                awayFormation: newState.lineups?.formations?.away || '4-3-3',
                homeXI: newValidH.slice(0, 11), awayXI: newValidA.slice(0, 11)
            };
            const finalUrl = `${frontendUrl}/api/og?data=${encodeBase64Safe(lineupOg)}`;
            
            if (config.events.lineups.x) payload.xImageUrl = finalUrl;
            if (config.events.lineups.fb) payload.fb1ImageUrl = finalUrl; 
        }
    } 
    else if (oldWasIncomplete && !newIsComplete && (newValidH.length > 0 || newValidA.length > 0)) {
        return NextResponse.json({ message: "Lineups still incomplete." });
    } 
    // 🟢 5. KICK OFF
    else if (preStatuses.includes(oldStatus) && live1HStatuses.includes(newStatus)) {
        if (config.events.kickoff.fb) {
            payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl}`;
        }
        if (config.events.kickoff.x) {
            payload.xMessage = `⏱️ KICK-OFF!\n\nWe are officially underway.\n\n👇 Live updates:\n${matchUrl}\n\n${hashtags}`;
        }
        
        if (config.events.kickoff.fb || config.events.kickoff.x) {
            const kickoffUrl = getMatchImageUrl('KICK-OFF', newState, frontendUrl);
            if (config.events.kickoff.x) payload.xImageUrl = kickoffUrl;
            if (config.events.kickoff.fb) payload.fb1ImageUrl = kickoffUrl; 
        }
    }
    // 🟢 6. HALF TIME
    else if (!htStatuses.includes(oldStatus) && htStatuses.includes(newStatus)) {
        if (config.events.halftime.fb) {
            payload.fb1Message = `⏸️ HALF TIME.\n\nHow do you rate the first half performance?\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇 Match Stats so far:\n${matchUrl}`;
        }
        if (config.events.halftime.x) {
            payload.xMessage = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇 Match Stats so far:\n${matchUrl}\n\n${hashtags}`;
        }
    }
    // 🟢 7. SECOND HALF (Treating as Kickoff config)
    else if (htStatuses.includes(oldStatus) && (live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus))) {
        if (config.events.kickoff.fb) {
            payload.fb1Message = `⏱️ SECOND HALF KICK-OFF!\n\nWe are back underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow the action here:\n👇\n${matchUrl}`;
        }
        if (config.events.kickoff.x) {
            payload.xMessage = `⏱️ SECOND HALF KICK-OFF!\n\nWe are back underway.\n\n👇 Follow the action:\n${matchUrl}\n\n${hashtags}`;
        }
    }
    // 🟢 8. FULL TIME
    else if (!strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        if (config.events.fulltime.fb) {
            payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl}`;
        }
        if (config.events.fulltime.x) {
            payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}.\n\n👇 Stats:\n${matchUrl}\n\n${hashtags}`;
        }

        if (config.events.fulltime.fb || config.events.fulltime.x) {
            const ftUrl = getMatchImageUrl('FULL TIME', newState, frontendUrl);
            if (config.events.fulltime.x) payload.xImageUrl = ftUrl;
            if (config.events.fulltime.fb) payload.fb1ImageUrl = ftUrl; 
        }
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "Event suppressed by Social Admin config." });

    // 🟢 UPDATED: PRE-WARM CACHE (Forces Vercel to physically draw the image, but ALWAYS fires the webhook)
    const rawUrls = [payload.xImageUrl, payload.fb1ImageUrl].filter(Boolean) as string[];
    const urlsToWarm = rawUrls.filter((url, index) => rawUrls.indexOf(url) === index);
    
    if (urlsToWarm.length > 0) {
        await Promise.all(urlsToWarm.map(async (url) => {
            try {
                // Set an 8-second timeout so it never hangs the webhook indefinitely
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); 

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                // Force Vercel to pull the image into memory, ensuring it caches
                if (res.ok) await res.arrayBuffer(); 
            } catch (e) {
                // If it times out, we just log it and move on.
                // We DO NOT delete the payload. We let Make.com retry catch it!
                console.error(`Cache warm timeout/error for ${url}. Firing webhook anyway.`);
            }
        }));
    }

    // Ping the Delivery Driver (Make.com & FB)
    await postToSocials(payload);

    try {
        await fetch(`${frontendUrl}/api/index-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
            body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' })
        });
    } catch (e) {}

    return NextResponse.json({ success: true, event: "Webhook complete" });
}