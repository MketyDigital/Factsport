export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SAFETY_MAP: Record<string, any> = {
    goals: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false },
    lineups: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false },
    kickoff: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false },
    fulltime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false },
    halftime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false },
    var_overturn: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false },
    penalty_awarded: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false }
};

async function secureStaticImage(internalFetchUrl: string, publicFallbackUrl: string, fileName: string, supabaseClient: any) {
    if (!internalFetchUrl) return "";
    try {
        const imgResponse = await fetch(internalFetchUrl, { headers: { 'Accept': 'image/png' } });
        let arrayBuffer;
        
        if (imgResponse.ok) {
            arrayBuffer = await imgResponse.arrayBuffer();
        } else {
            console.log("⚠️ Internal OG render blocked, breaking out to public bridge...");
            const fallbackRes = await fetch(publicFallbackUrl);
            if (!fallbackRes.ok) return "";
            arrayBuffer = await fallbackRes.arrayBuffer();
        }

        const { error } = await supabaseClient.storage
            .from('socials')
            .upload(`${fileName}.png`, arrayBuffer, {
                contentType: 'image/png',
                upsert: true 
            });

        if (error) {
            console.error("Supabase Storage Error:", error);
            return publicFallbackUrl; 
        }

        const { data } = supabaseClient.storage.from('socials').getPublicUrl(`${fileName}.png`);
        return `${data.publicUrl}?v=${Date.now()}`;
    } catch (err) {
        console.error("Image Proxy Failed:", err);
        return publicFallbackUrl; 
    }
}

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
        return type === 'penalty_awarded'; 
    });
};

const parseTime = (t: any) => {
    const str = String(t).replace(/[^0-9+]/g, ''); 
    const parts = str.split('+');
    return (parseInt(parts[0]) || 0) * 100 + (parseInt(parts[1]) || 0); 
};

// Expanded KNOWN_TEAMS list with national teams and precise mapping
const KNOWN_TEAMS: Record<string, string> = {
    // English Premier League
    'manchester city': 'MCI', 'man city': 'MCI', 'm. city': 'MCI', 'manchester united': 'MUN', 'man united': 'MUN', 'man utd': 'MUN',
    'arsenal': 'ARS', 'arsenal fc': 'ARS', 'chelsea': 'CHE', 'chelsea fc': 'CHE', 'liverpool': 'LIV', 'liverpool fc': 'LIV',
    'tottenham hotspur': 'TOT', 'tottenham': 'TOT', 'spurs': 'TOT', 'newcastle united': 'NEW', 'newcastle': 'NEW', 'newcastle utd': 'NEW',
    'aston villa': 'AVL', 'villa': 'AVL', 'west ham united': 'WHU', 'west ham': 'WHU', 'brighton & hove albion': 'BHA', 'brighton': 'BHA', 'brighton hove': 'BHA',
    'wolverhampton wanderers': 'WOL', 'wolverhampton': 'WOL', 'wolves': 'WOL', 'nottingham forest': 'NFO', 'nottm forest': 'NFO', 'nottingham': 'NFO',
    'leicester city': 'LEI', 'leicester': 'LEI', 'everton': 'EVE', 'everton fc': 'EVE', 'crystal palace': 'CRY', 'palace': 'CRY',
    'brentford': 'BRE', 'brentford fc': 'BRE', 'fulham': 'FUL', 'fulham fc': 'FUL', 'afc bournemouth': 'BOU', 'bournemouth': 'BOU',
    'southampton': 'SOU', 'saints': 'SOU', 'ipswich town': 'IPS', 'ipswich': 'IPS', 
    // La Liga
    'real madrid': 'RMA', 'madrid': 'RMA',
    'barcelona': 'BAR', 'barca': 'BAR', 'fc barcelona': 'BAR', 'atletico madrid': 'ATM', 'atlético': 'ATM', 'atletico': 'ATM', 'atlético de madrid': 'ATM',
    'athletic club': 'ATH', 'athletic bilbao': 'ATH', 'athletic': 'ATH', 'real sociedad': 'RSO', 'sociedad': 'RSO', 'real betis': 'BET', 'betis': 'BET',
    'sevilla': 'SEV', 'sevilla fc': 'SEV', 'valencia': 'VAL', 'valencia cf': 'VAL', 'villarreal': 'VIL', 'villarreal cf': 'VIL',
    'celta vigo': 'CEL', 'celta': 'CEL', 'celta de vigo': 'CEL', 'girona': 'GIR', 'girona fc': 'GIR', 'osasuna': 'OSA', 'ca osasuna': 'OSA',
    'mallorca': 'MLL', 'rcd mallorca': 'MLL', 
    // Serie A
    'juventus': 'JUV', 'juve': 'JUV', 'ac milan': 'MIL', 'milan': 'MIL',
    'inter milan': 'INT', 'inter': 'INT', 'internazionale': 'INT', 'ssc napoli': 'NAP', 'napoli': 'NAP', 'as roma': 'ROM', 'roma': 'ROM',
    'ss lazio': 'LAZ', 'lazio': 'LAZ', 'atalanta': 'ATA', 'atalanta bc': 'ATA', 'fiorentina': 'FIO', 'acf fiorentina': 'FIO',
    'bologna': 'BOL', 'bologna fc': 'BOL', 'torino': 'TOR', 'torino fc': 'TOR', 
    // Bundesliga
    'bayern munich': 'BAY', 'bayern': 'BAY', 'fc bayern': 'BAY', 'bayern münchen': 'BAY',
    'borussia dortmund': 'BVB', 'dortmund': 'BVB', 'bayer 04 leverkusen': 'B04', 'leverkusen': 'B04', 'bayer leverkusen': 'B04',
    'rb leipzig': 'RBL', 'leipzig': 'RBL', 'eintracht frankfurt': 'SGE', 'frankfurt': 'SGE', 'eintracht': 'SGE',
    'borussia monchengladbach': 'BMG', 'gladbach': 'BMG', 'mgladbach': 'BMG', 'mönchengladbach': 'BMG', 'vfb stuttgart': 'VFB', 'stuttgart': 'VFB',
    'wolfsburg': 'WOB', 'vfl wolfsburg': 'WOB', 'sc freiburg': 'SCF', 'freiburg': 'SCF', 'union berlin': 'FCU', 'fc union berlin': 'FCU',
    // Ligue 1
    'paris saint germain': 'PSG', 'psg': 'PSG', 'paris sg': 'PSG', 'paris saint-germain': 'PSG', 'olympique de marseille': 'MAR', 'marseille': 'MAR', 'om': 'MAR',
    'olympique lyon': 'LYO', 'lyon': 'LYO', 'ol': 'LYO', 'as monaco': 'ASM', 'monaco': 'ASM', 'lille osc': 'LOSC', 'lille': 'LOSC',
    'rc lens': 'RCL', 'lens': 'RCL', 'ogc nice': 'OGCN', 'nice': 'OGCN', 
    // More European
    'ajax': 'AJA', 'afc ajax': 'AJA', 'psv eindhoven': 'PSV', 'psv': 'PSV',
    'feyenoord': 'FEY', 'sporting cp': 'SCP', 'sporting': 'SCP', 'sporting lisbon': 'SCP', 'sl benfica': 'SLB', 'benfica': 'SLB',
    'fc porto': 'FCP', 'porto': 'FCP', 'celtic': 'CEL', 'celtic fc': 'CEL', 'rangers': 'RAN', 'rangers fc': 'RAN', 'galatasaray': 'GAL', 'galatasaray sk': 'GAL',
    'fenerbahce': 'FEN', 'fenerbahçe': 'FEN', 'besiktas': 'BES', 'beşiktaş': 'BES', 'club brugge': 'BRU', 
    // South America / Misc
    'boca juniors': 'BOC', 'river plate': 'RIV', 'flamengo': 'FLA', 'palmeiras': 'PAL', 'al nassr': 'ALN', 'al hilal': 'ALH', 'inter miami': 'MIA',
    
    // NATIONAL TEAMS
    'argentina': 'ARG', 'brazil': 'BRA', 'france': 'FRA', 'england': 'ENG', 'spain': 'ESP', 
    'italy': 'ITA', 'germany': 'GER', 'portugal': 'POR', 'netherlands': 'NED', 'holland': 'NED',
    'belgium': 'BEL', 'croatia': 'CRO', 'uruguay': 'URU', 'colombia': 'COL', 'usa': 'USA', 
    'united states': 'USA', 'mexico': 'MEX', 'senegal': 'SEN', 'morocco': 'MAR', 'japan': 'JPN', 
    'south korea': 'KOR', 'switzerland': 'SUI', 'denmark': 'DEN', 'sweden': 'SWE', 'poland': 'POL',
    'wales': 'WAL', 'scotland': 'SCO', 'ireland': 'IRL', 'republic of ireland': 'IRL',
    'norway': 'NOR', 'austria': 'AUT', 'hungary': 'HUN', 'serbia': 'SRB', 'turkey': 'TUR',
    'ukraine': 'UKR', 'czech republic': 'CZE', 'czechia': 'CZE', 'greece': 'GRE', 'romania': 'ROU',
    'chile': 'CHI', 'peru': 'PER', 'ecuador': 'ECU', 'paraguay': 'PAR', 'venezuela': 'VEN',
    'bolivia': 'BOL', 'canada': 'CAN', 'costa rica': 'CRC', 'panama': 'PAN', 'jamaica': 'JAM',
    'nigeria': 'NGA', 'egypt': 'EGY', 'cameroon': 'CMR', 'ghana': 'GHA', 'ivory coast': 'CIV', 
    'cote d\'ivoire': 'CIV', 'algeria': 'ALG', 'tunisia': 'TUN', 'mali': 'MLI',
    'iran': 'IRN', 'australia': 'AUS', 'saudi arabia': 'KSA', 'qatar': 'QAT', 'uzbekistan': 'UZB',
    'new zealand': 'NZL'
};

const getTla = (name: string, fallbackTla?: string) => {
    if (!name) return 'TM';
    const normalized = name.replace(/['"]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (KNOWN_TEAMS[normalized]) return KNOWN_TEAMS[normalized];
    if (fallbackTla) return fallbackTla.toUpperCase();
    return name.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
};

const getLeagueHashtags = (leagueName: string) => {
    const map: Record<string, string> = {
        'Premier League': '#PremierLeague #EPL', 'La Liga': '#LaLiga', 'Bundesliga': '#Bundesliga', 'Serie A': '#SerieA',
        'Ligue 1': '#Ligue1', 'Champions League': '#UCL #ChampionsLeague', 'Europa League': '#UEL',
        'World Cup': '#WorldCup #FIFAWorldCup', 'Euros': '#Euro', 'Copa America': '#CopaAmerica'
    };
    return map[leagueName] || `#${String(leagueName).replace(/[^a-zA-Z0-9]/g, '')}`;
};

function encodeBase64Safe(obj: any) {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const compressPlayerName = (player: string) => {
    if (!player) return '';
    const numMatch = player.match(/\b(\d{1,2})\b/);
    const num = numMatch ? numMatch[0] : '';
    const nameCleaned = player.replace(/\b\d{1,2}\b/g, '').replace(/[()]/g, '').trim();
    const lastName = nameCleaned ? nameCleaned.split(' ').pop() : '';
    return num ? `${num} ${lastName}` : lastName;
};

function parseTemplate(text: string, state: any, matchUrl: string, extra: any) {
    if (!text) return '';
    let processedText = text;

    if (extra.activeCta) {
        if (processedText.includes('[PRE_CTA]')) {
            processedText = processedText.replace(/\[PRE_CTA\]/g, extra.activeCta);
        } else if (processedText.includes('[CTA]')) {
            processedText = processedText.replace(/\[CTA\]/g, extra.activeCta);
        } else if (!processedText.includes('[LINK]')) {
            processedText = processedText + `\n\n${extra.activeCta}`;
        }
    }

    return processedText
        .replace(/\[HOME\]/g, state.home_team || '')
        .replace(/\[AWAY\]/g, state.away_team || '')
        .replace(/\[H_SCORE\]/g, state.home_score || 0)
        .replace(/\[A_SCORE\]/g, state.away_score || 0)
        .replace(/\[LINK\]/g, matchUrl)
        .replace(/\[TIME\]/g, extra.time || '')
        .replace(/\[SCORER\]/g, extra.scorer || '')
        .replace(/\[STATUS\]/g, extra.statusText || '')
        .replace(/\[HASHTAGS\]/g, extra.hashtags || '');
}

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const newState = body.record;
    const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };
    
    if (!newState) return NextResponse.json({ message: "No record found" }, { status: 400 });

    const oldStatus = String(oldState.status).toUpperCase();
    const newStatus = String(newState.status).toUpperCase();
    const strictlyFinishedStatuses = ['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED'];
    
    if (strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        return NextResponse.json({ message: "Match already finished. Ignoring late correction." });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || { credentials: {}, vip_teams: [], vip_leagues: [], events: {}, templates: {} };

    const isVipTeam = (config.vip_teams || []).includes(newState.home_team) || (config.vip_teams || []).includes(newState.away_team);
    const isVipLeague = (config.vip_leagues || []).includes(newState.league);
    let isVIP = isVipTeam || isVipLeague;
    
    if (!isVIP) {
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team, league').like('match_date', `${today}%`).order('match_date', { ascending: true });
        const hasVIPToday = todaysMatches?.some(m => (config.vip_teams || []).includes(m.home_team) || (config.vip_teams || []).includes(m.away_team) || (config.vip_leagues || []).includes(m.league));
        if (hasVIPToday) return NextResponse.json({ message: "Not a VIP team or league." });
        if (todaysMatches && todaysMatches.length > 0 && newState.id === todaysMatches[0].id) isVIP = true;
        else return NextResponse.json({ message: "Not the fallback match." });
    }

    const frontendUrl = 'https://factsport.com'; 
    const internalOrigin = new URL(request.url).origin; 
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    const hashtags = `#${getTla(newState.home_team, newState.home_tla)} #${getTla(newState.away_team, newState.away_tla)} ${getLeagueHashtags(newState.league)} #Football`; 
    
    let ctaText = "👇 Match Stats & Updates:\n";
    let preMatchCta = "👇 See tactical setup & subs:\n";
    
    if (newState.media_url || newState.stream_url) {
        const streamTarget = newState.stream_url || newState.media_url;
        const isAudio = newState.media_mode === 'audio' || String(streamTarget).includes('audio') || String(streamTarget).includes('radio');
        if (isAudio) {
            ctaText = `🎧 Listen to Live Audio Commentary:\n👉 ${streamTarget}\n\n👇 Match Stats:\n`;
            preMatchCta = `🎧 Live radio coverage begins at kick-off:\n👉 ${streamTarget}\n\n👇 Team Lineups:\n`;
        } else {
            ctaText = `📺 Watch Live Match Stream:\n👉 ${streamTarget}\n\n👇 Live Stats:\n`;
            preMatchCta = `📺 Live video stream begins at kick-off:\n👉 ${streamTarget}\n\n👇 Team Formations:\n`;
        }
    }

    const oldTotal = (oldState.home_score || 0) + (oldState.away_score || 0);
    const newTotal = (newState.home_score || 0) + (newState.away_score || 0);
    const oldGoalsList = getValidGoals(oldState.match_events || []);
    const newGoalsList = getValidGoals(newState.match_events || []);
    const oldPenaltiesList = getPenaltyEvents(oldState.match_events || []);
    const newPenaltiesList = getPenaltyEvents(newState.match_events || []);

    const getValidNames = (arr: any[]) => (Array.isArray(arr) ? arr : []).map(p => p?.name || p?.player?.name || p?.playerName || (typeof p === 'string' ? p : null)).filter(Boolean);
    const oldValidH = getValidNames(oldState.lineups?.home); const oldValidA = getValidNames(oldState.lineups?.away);
    const newValidH = getValidNames(newState.lineups?.home); const newValidA = getValidNames(newState.lineups?.away);
    
    const oldHasFullLineups = oldValidH.length >= 11 && oldValidA.length >= 11;
    const newHasFullLineups = newValidH.length >= 11 && newValidA.length >= 11;

    const preStatuses = ['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD'];
    const live1HStatuses = ['IN_PLAY', 'LIVE', '1H', 'FIRST_HALF', 'FIRST HALF'];
    const htStatuses = ['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME', 'PAUSED'];
    const live2HStatuses = ['2H', 'SECOND_HALF', 'SECOND HALF'];

    let eventKey = null;
    let extraData: any = { ctaText, preMatchCta, hashtags };
    let ogPayload = null;

    if (!strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        eventKey = 'fulltime';
        ogPayload = { type: 'versus', label: 'FULL TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo, homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla) };
    } 
    else if (newTotal < oldTotal) {
        eventKey = 'var_overturn';
    } 
    else if (newTotal > oldTotal || newGoalsList.length > oldGoalsList.length) {
        if (newGoalsList.length < newTotal) return NextResponse.json({ message: "Facts data lagging behind scoreboard. Waiting for next ping." });
        eventKey = 'goals';
        extraData.statusText = live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus) ? '' : ` (${newState.status})`;
        if (newGoalsList.length > 0) {
            const sortedGoals = [...newGoalsList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
            const latest = sortedGoals[0];
            const player = latest.player || latest.playerName || latest.name || "Unknown Player";
            const time = latest.time || latest.minute ? `${latest.time || latest.minute}' ` : '';
            extraData.scorer = `\n⚽ GOAL - ${player} (${time.trim()})\n`;
        } 
        if (!extraData.scorer) extraData.scorer = `\n⚽ GOAL - Confirmed!\n`;

        ogPayload = { type: 'versus', label: ['PEN', 'PEN_SHOOT_OUT'].includes(newStatus) ? 'PENALTY SCORED' : 'GOAL ALERT!', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo, homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla) };
    } 
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        eventKey = 'penalty_awarded';
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        extraData.time = sortedPens[0].time || sortedPens[0].minute ? `${sortedPens[0].time || sortedPens[0].minute}'` : '';
    } 
    else if (!htStatuses.includes(oldStatus) && htStatuses.includes(newStatus)) {
        eventKey = 'halftime';
        ogPayload = { type: 'versus', label: 'HALF TIME', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo, homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla) };
    } 
    else if (htStatuses.includes(oldStatus) && (live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus))) {
        eventKey = 'kickoff';
    } 
    else if (preStatuses.includes(oldStatus) && live1HStatuses.includes(newStatus)) {
        eventKey = 'kickoff';
        ogPayload = { type: 'versus', label: 'KICK-OFF', home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo, homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla) };
    } 
    else if (!oldHasFullLineups && newHasFullLineups) { 
        eventKey = 'lineups';
        ogPayload = { 
            type: 'pitch', label: 'STARTING XI', 
            home: newState.home_team, away: newState.away_team, 
            homeFormation: newState.lineups?.formations?.home || '4-3-3',
            awayFormation: newState.lineups?.formations?.away || '4-3-3',
            homeXI: newValidH.slice(0, 11).map(compressPlayerName), 
            awayXI: newValidA.slice(0, 11).map(compressPlayerName)
        };
    }

    if (!eventKey) return NextResponse.json({ message: "No relevant trigger." });

    const baseSafetyConfig = SAFETY_MAP[eventKey] || {};
    const dbEventConfig = config.events[eventKey] || {};
    const evtConfig = { ...baseSafetyConfig, ...dbEventConfig };

    const tpl = config.templates?.[eventKey] || {};
    extraData.activeCta = (eventKey === 'lineups' || eventKey === 'kickoff') ? preMatchCta : ctaText;

    const fb1Text = evtConfig.fb1 ? parseTemplate(tpl.fb1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]`, newState, matchUrl, extraData) : null;
    const fb2Text = evtConfig.fb2 ? parseTemplate(tpl.fb2 || fb1Text || '', newState, matchUrl, extraData) : null;
    const make1Text = evtConfig.make1 ? parseTemplate(tpl.make1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]\n[HASHTAGS]`, newState, matchUrl, extraData) : null;
    const make2Text = evtConfig.make2 ? parseTemplate(tpl.make2 || make1Text || '', newState, matchUrl, extraData) : null;
    const tgMsg = evtConfig.tg_general ? parseTemplate(tpl.tg_general || `<b>[HOME] [H_SCORE] - [A_SCORE] [AWAY]</b>\n<a href="[LINK]">Match Center</a>`, newState, matchUrl, extraData) : null;

    const bufX1Text = evtConfig.buf_x1 ? parseTemplate(tpl.buf_x1 || tpl.make1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]\n[HASHTAGS]`, newState, matchUrl, extraData) : null;
    const bufX2Text = evtConfig.buf_x2 ? parseTemplate(tpl.buf_x2 || tpl.make2 || bufX1Text || '', newState, matchUrl, extraData) : null;
    const bufFb1Text = evtConfig.buf_fb1 ? parseTemplate(tpl.buf_fb1 || tpl.fb1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]`, newState, matchUrl, extraData) : null;
    const bufFb2Text = evtConfig.buf_fb2 ? parseTemplate(tpl.buf_fb2 || tpl.fb2 || bufFb1Text || '', newState, matchUrl, extraData) : null;

    const creds = config.credentials || {};

    try {
        const bufferToken = creds.buffer_token || process.env.BUFFER_ACCESS_TOKEN;
        
        let finalStaticImage = null;
        if (ogPayload) { 
            const payloadEncoded = encodeBase64Safe(ogPayload);
            const internalFetchUrl = `${internalOrigin}/api/og?data=${payloadEncoded}`;
            const publicFallbackUrl = `${frontendUrl}/api/og?data=${payloadEncoded}`;
            const timestampKey = `match_${newState.id}_evt_${eventKey}_ts_${Date.now()}`; 
            
            finalStaticImage = await secureStaticImage(internalFetchUrl, publicFallbackUrl, timestampKey, supabase);
        }

        const makePayload1: any = { fb2_text: fb1Text, x_text: make1Text, buf_x_text: bufX1Text, buf_fb_text: bufFb1Text };
        if (finalStaticImage) makePayload1.x_image_url = finalStaticImage;

        const makePayload2: any = { fb2_text: fb2Text, x_text: make2Text, buf_x_text: bufX2Text, buf_fb_text: bufFb2Text };
        if (finalStaticImage) makePayload2.x_image_url = finalStaticImage;

        const postToBufferDirectly = async (text: string, safeImgUrl: string, profileId: string, token: string) => {
            const payload = {
                query: "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }",
                variables: { input: { text: text || "", channelId: profileId, schedulingType: "automatic", mode: "shareNow", assets: safeImgUrl && safeImgUrl.length > 5 ? [ { image: { url: safeImgUrl } } ] : [] } }
            };
            const res = await fetch("https://api.buffer.com/1/graphql", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload) });
            return await res.json();
        };

        if (evtConfig.buf_x1 && bufferToken && creds.buffer_x1_id) { await postToBufferDirectly(bufX1Text!, finalStaticImage!, creds.buffer_x1_id, bufferToken).catch(e => console.error("BUF X1 Error:", e)); }
        if (evtConfig.buf_x2 && bufferToken && creds.buffer_x2_id) { await postToBufferDirectly(bufX2Text!, finalStaticImage!, creds.buffer_x2_id, bufferToken).catch(e => console.error("BUF X2 Error:", e)); }
        if (evtConfig.buf_fb1 && bufferToken && creds.buffer_fb1_id) { await postToBufferDirectly(bufFb1Text!, finalStaticImage!, creds.buffer_fb1_id, bufferToken).catch(e => console.error("BUF FB1 Error:", e)); }
        if (evtConfig.buf_fb2 && bufferToken && creds.buffer_fb2_id) { await postToBufferDirectly(bufFb2Text!, finalStaticImage!, creds.buffer_fb2_id, bufferToken).catch(e => console.error("BUF FB2 Error:", e)); }

        if (evtConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            const url = finalStaticImage ? `https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(finalStaticImage)}&message=${encodeURIComponent(fb1Text!)}&access_token=${token}` : `https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fb1Text!)}&access_token=${token}`;
            await fetch(url, { method: 'POST' }).then(async r => { if(!r.ok) console.error("FB1 Error:", await r.text()); }).catch(()=>{});
        }

        if (evtConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            const url = finalStaticImage ? `https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(finalStaticImage)}&message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}` : `https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`;
            await fetch(url, { method: 'POST' }).then(async r => { if(!r.ok) console.error("FB2 Error:", await r.text()); }).catch(()=>{});
        }

        if (evtConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) { await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makePayload1) }).catch(()=>{}); }
        if (evtConfig.make2 && creds.make_webhook_2) { await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makePayload2) }).catch(()=>{}); }

        if (evtConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
            for (const channel of creds.tg_general_channels) { await fetch(`https://api.telegram.org/bot${creds.telegram_bot_token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: channel.chatId, text: tgMsg, parse_mode: 'HTML', disable_web_page_preview: false }) }).catch(()=>{}); }
        }

        fetch(`${frontendUrl}/api/index-url`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` }, body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' }) }).catch(() => {});

    } catch (err) { console.error("Critical error firing socials:", err); }

    return NextResponse.json({ success: true, event: eventKey });
}
