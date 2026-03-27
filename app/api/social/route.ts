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

// 🟢 KNOWN TEAM ABBREVIATIONS DICTIONARY (The "Smart Alias" Mapping)
const KNOWN_TEAMS: Record<string, string> = {
    'manchester city': 'MCI', 'man city': 'MCI', 'm. city': 'MCI',
    'manchester united': 'MUN', 'man united': 'MUN', 'man utd': 'MUN',
    'arsenal': 'ARS', 'arsenal fc': 'ARS',
    'chelsea': 'CHE', 'chelsea fc': 'CHE',
    'liverpool': 'LIV', 'liverpool fc': 'LIV',
    'tottenham hotspur': 'TOT', 'tottenham': 'TOT', 'spurs': 'TOT',
    'newcastle united': 'NEW', 'newcastle': 'NEW', 'newcastle utd': 'NEW',
    'aston villa': 'AVL', 'villa': 'AVL',
    'west ham united': 'WHU', 'west ham': 'WHU',
    'brighton & hove albion': 'BHA', 'brighton': 'BHA', 'brighton hove': 'BHA',
    'wolverhampton wanderers': 'WOL', 'wolverhampton': 'WOL', 'wolves': 'WOL',
    'nottingham forest': 'NFO', 'nottm forest': 'NFO', 'nottingham': 'NFO',
    'leicester city': 'LEI', 'leicester': 'LEI',
    'everton': 'EVE', 'everton fc': 'EVE',
    'crystal palace': 'CRY', 'palace': 'CRY',
    'brentford': 'BRE', 'brentford fc': 'BRE',
    'fulham': 'FUL', 'fulham fc': 'FUL',
    'afc bournemouth': 'BOU', 'bournemouth': 'BOU',
    'southampton': 'SOU', 'saints': 'SOU',
    'ipswich town': 'IPS', 'ipswich': 'IPS',
    'real madrid': 'RMA', 'madrid': 'RMA',
    'barcelona': 'BAR', 'barca': 'BAR', 'fc barcelona': 'BAR',
    'atletico madrid': 'ATM', 'atlético': 'ATM', 'atletico': 'ATM', 'atlético de madrid': 'ATM',
    'athletic club': 'ATH', 'athletic bilbao': 'ATH', 'athletic': 'ATH',
    'real sociedad': 'RSO', 'sociedad': 'RSO',
    'real betis': 'BET', 'betis': 'BET',
    'sevilla': 'SEV', 'sevilla fc': 'SEV',
    'valencia': 'VAL', 'valencia cf': 'VAL',
    'villarreal': 'VIL', 'villarreal cf': 'VIL',
    'celta vigo': 'CEL', 'celta': 'CEL', 'celta de vigo': 'CEL',
    'girona': 'GIR', 'girona fc': 'GIR',
    'osasuna': 'OSA', 'ca osasuna': 'OSA',
    'mallorca': 'MLL', 'rcd mallorca': 'MLL',
    'juventus': 'JUV', 'juve': 'JUV',
    'ac milan': 'MIL', 'milan': 'MIL',
    'inter milan': 'INT', 'inter': 'INT', 'internazionale': 'INT',
    'ssc napoli': 'NAP', 'napoli': 'NAP',
    'as roma': 'ROM', 'roma': 'ROM',
    'ss lazio': 'LAZ', 'lazio': 'LAZ',
    'atalanta': 'ATA', 'atalanta bc': 'ATA',
    'fiorentina': 'FIO', 'acf fiorentina': 'FIO',
    'bologna': 'BOL', 'bologna fc': 'BOL',
    'torino': 'TOR', 'torino fc': 'TOR',
    'bayern munich': 'BAY', 'bayern': 'BAY', 'fc bayern': 'BAY', 'bayern münchen': 'BAY',
    'borussia dortmund': 'BVB', 'dortmund': 'BVB',
    'bayer 04 leverkusen': 'B04', 'leverkusen': 'B04', 'bayer leverkusen': 'B04',
    'rb leipzig': 'RBL', 'leipzig': 'RBL',
    'eintracht frankfurt': 'SGE', 'frankfurt': 'SGE', 'eintracht': 'SGE',
    'borussia monchengladbach': 'BMG', 'gladbach': 'BMG', 'mgladbach': 'BMG', 'mönchengladbach': 'BMG',
    'vfb stuttgart': 'VFB', 'stuttgart': 'VFB',
    'wolfsburg': 'WOB', 'vfl wolfsburg': 'WOB',
    'sc freiburg': 'SCF', 'freiburg': 'SCF',
    'union berlin': 'FCU', 'fc union berlin': 'FCU',
    'paris saint germain': 'PSG', 'psg': 'PSG', 'paris sg': 'PSG', 'paris saint-germain': 'PSG',
    'olympique de marseille': 'MAR', 'marseille': 'MAR', 'om': 'MAR',
    'olympique lyonnais': 'LYO', 'lyon': 'LYO', 'ol': 'LYO',
    'as monaco': 'ASM', 'monaco': 'ASM',
    'lille osc': 'LOSC', 'lille': 'LOSC',
    'rc lens': 'RCL', 'lens': 'RCL',
    'ogc nice': 'OGCN', 'nice': 'OGCN',
    'ajax': 'AJA', 'afc ajax': 'AJA',
    'psv eindhoven': 'PSV', 'psv': 'PSV',
    'feyenoord': 'FEY',
    'sporting cp': 'SCP', 'sporting': 'SCP', 'sporting lisbon': 'SCP',
    'sl benfica': 'SLB', 'benfica': 'SLB',
    'fc porto': 'FCP', 'porto': 'FCP',
    'celtic': 'CEL', 'celtic fc': 'CEL',
    'rangers': 'RAN', 'rangers fc': 'RAN',
    'galatasaray': 'GAL', 'galatasaray sk': 'GAL',
    'fenerbahce': 'FEN', 'fenerbahçe': 'FEN',
    'besiktas': 'BES', 'beşiktaş': 'BES',
    'argentina': 'ARG',
    'brazil': 'BRA', 'brasil': 'BRA',
    'france': 'FRA',
    'england': 'ENG',
    'spain': 'ESP', 'españa': 'ESP',
    'germany': 'GER', 'deutschland': 'GER',
    'italy': 'ITA', 'italia': 'ITA',
    'portugal': 'POR',
    'netherlands': 'NED', 'holland': 'NED',
    'belgium': 'BEL',
    'croatia': 'CRO',
    'uruguay': 'URU',
    'colombia': 'COL',
    'united states': 'USA', 'usa': 'USA', 'usmnt': 'USA',
    'mexico': 'MEX',
    'nigeria': 'NGA', 'super eagles': 'NGA',
    'senegal': 'SEN',
    'morocco': 'MAR',
    'egypt': 'EGY',
    'ghana': 'GHA',
    'ivory coast': 'CIV', 'cote d\'ivoire': 'CIV',
    'japan': 'JPN',
    'south korea': 'KOR', 'korea republic': 'KOR'
};

const getMatchHashtag = (home: string, away: string, homeTla?: string, awayTla?: string) => {
    const getTla = (name: string, fallbackTla?: string) => {
        const normalized = name.replace(/['"]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (KNOWN_TEAMS[normalized]) return KNOWN_TEAMS[normalized];
        if (fallbackTla) return fallbackTla.toUpperCase();
        return name.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    };

    const cleanH = getTla(home, homeTla);
    const cleanA = getTla(away, awayTla);
    return `#${cleanH}${cleanA} #FactSportLive`;
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
    
    // Safety check to avoid silent crashes
    if (!newState) {
        console.error("WEBHOOK ERROR: Missing record payload.");
        return NextResponse.json({ message: "No record found" }, { status: 400 });
    }

    const oldStatus = String(oldState.status).toUpperCase();
    const newStatus = String(newState.status).toUpperCase();

    const strictlyFinishedStatuses = ['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED'];
    if (strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        return NextResponse.json({ message: "Match already finished. Ignoring late correction." });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    
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

    const isVipTeam = config.vip_teams.includes(newState.home_team) || config.vip_teams.includes(newState.away_team);
    const isVipLeague = config.vip_leagues.includes(newState.league);
    let isVIP = isVipTeam || isVipLeague;
    
    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team, league').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => config.vip_teams.includes(m.home_team) || config.vip_teams.includes(m.away_team) || config.vip_leagues.includes(m.league));
        
        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team or league." });
        if (todaysMatches && todaysMatches.length > 0 && newState.id === todaysMatches[0].id) isVIP = true;
        else return NextResponse.json({ message: "Not the fallback match." });
    }

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

    if (newTotal < oldTotal) {
        if (config.events.var_overturn.fb) payload.fb1Message = `❌ VAR DECISION: OVERTURNED - Previous G/Event has been canceled.\n\nThe score returns to:\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
        if (config.events.var_overturn.x) payload.xMessage = `❌ VAR DECISION: OVERTURNED - Previous G/Event canceled.\n\n⚽ ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}\n\n${hashtags}`;
    } 
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
            if (config.events.goals.fb) payload.fb1Message = `🥅 PENALTY SCORED!\n\nShootout Update: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}`;
            if (config.events.goals.x) {
                payload.xMessage = `🥅 PENALTY SCORED!\n\nShootout: ${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇\n${matchUrl}\n\n${hashtags}`;
                payload.xImageUrl = getMatchImageUrl('PENALTY SCORED', newState, frontendUrl);
            }
        } else {
            if (config.events.goals.fb) payload.fb1Message = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n${matchUrl}`;
            if (config.events.goals.x) {
                payload.xMessage = `🚨 GOAL ALERT!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}${statusText}\n${scorerText}\n👇\n${matchUrl}\n\n${hashtags}`;
                payload.xImageUrl = getMatchImageUrl('GOAL ALERT!', newState, frontendUrl); 
            }
        }
    } 
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        const time = sortedPens[0].time || sortedPens[0].minute ? `${sortedPens[0].time || sortedPens[0].minute}'` : '';
        
        if (config.events.penalty_awarded.fb) payload.fb1Message = `⚠️ PENALTY AWARDED - (Confirmed by Referee/VAR) ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}`;
        if (config.events.penalty_awarded.x) payload.xMessage = `⚠️ PENALTY AWARDED - ${time}\n\nMassive moment in the match! Will they convert it?\n\n👇\n${matchUrl}\n\n${hashtags}`;
    }
    else if (oldWasIncomplete && newIsComplete) {
        if (config.events.lineups.fb) payload.fb1Message = `📋 STARTING XI ANNOUNCED!\n\n${newState.home_team} vs ${newState.away_team}\n\n👇 See the tactical setup & subs here!\n${matchUrl}`;
        if (config.events.lineups.x) payload.xMessage = `🚨 STARTING XI: ${newState.home_team} vs ${newState.away_team}! 👇\n${matchUrl}\n\n${hashtags}`;
        
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
    else if (preStatuses.includes(oldStatus) && live1HStatuses.includes(newStatus)) {
        if (config.events.kickoff.fb) payload.fb1Message = `⏱️ KICK-OFF!\n\nWe are officially underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow live updates here:\n👇\n${matchUrl}`;
        if (config.events.kickoff.x) payload.xMessage = `⏱️ KICK-OFF!\n\nWe are officially underway.\n\n👇 Live updates:\n${matchUrl}\n\n${hashtags}`;
        
        if (config.events.kickoff.fb || config.events.kickoff.x) {
            const kickoffUrl = getMatchImageUrl('KICK-OFF', newState, frontendUrl);
            if (config.events.kickoff.x) payload.xImageUrl = kickoffUrl;
            if (config.events.kickoff.fb) payload.fb1ImageUrl = kickoffUrl; 
        }
    }
    else if (!htStatuses.includes(oldStatus) && htStatuses.includes(newStatus)) {
        if (config.events.halftime.fb) payload.fb1Message = `⏸️ HALF TIME.\n\nHow do you rate the first half performance?\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇 Match Stats so far:\n${matchUrl}`;
        if (config.events.halftime.x) payload.xMessage = `⏸️ HALF TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\n👇 Match Stats so far:\n${matchUrl}\n\n${hashtags}`;
    }
    else if (htStatuses.includes(oldStatus) && (live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus))) {
        if (config.events.kickoff.fb) payload.fb1Message = `⏱️ SECOND HALF KICK-OFF!\n\nWe are back underway: ${newState.home_team} vs ${newState.away_team}.\n\nFollow the action here:\n👇\n${matchUrl}`;
        if (config.events.kickoff.x) payload.xMessage = `⏱️ SECOND HALF KICK-OFF!\n\nWe are back underway.\n\n👇 Follow the action:\n${matchUrl}\n\n${hashtags}`;
    }
    else if (!strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        if (config.events.fulltime.fb) payload.fb1Message = `⏹️ FULL TIME!\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}\n\nMatch stats and ratings available now:\n👇\n${matchUrl}`;
        if (config.events.fulltime.x) payload.xMessage = `⏹️ FULL TIME.\n\n${newState.home_team} ${newState.home_score} - ${newState.away_score} ${newState.away_team}.\n\n👇 Stats:\n${matchUrl}\n\n${hashtags}`;

        if (config.events.fulltime.fb || config.events.fulltime.x) {
            const ftUrl = getMatchImageUrl('FULL TIME', newState, frontendUrl);
            if (config.events.fulltime.x) payload.xImageUrl = ftUrl;
            if (config.events.fulltime.fb) payload.fb1ImageUrl = ftUrl; 
        }
    }

    if (!payload.fb1Message && !payload.xMessage) return NextResponse.json({ message: "Event suppressed by Social Admin config." });

    // 🟢 INSTANT DELIVERY TO MAKE.COM
    // By awaiting postToSocials, Cloudflare keeps the worker alive just long enough to send the JSON.
    // Make.com will receive the URL, wait 20 seconds (via your module), and then fetch the image safely.
    try {
        await postToSocials(payload);
        
        fetch(`${frontendUrl}/api/index-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
            body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' })
        }).catch(() => {});

    } catch (err) {
        console.error("Critical error firing socials:", err);
    }

    return NextResponse.json({ success: true, event: "Webhook successfully fired." });
}