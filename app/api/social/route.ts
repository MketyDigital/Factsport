export const runtime = 'edge';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

const KNOWN_TEAMS: Record<string, string> = {
    'manchester city': 'MCI', 'man city': 'MCI', 'm. city': 'MCI', 'manchester united': 'MUN', 'man united': 'MUN', 'man utd': 'MUN',
    'arsenal': 'ARS', 'arsenal fc': 'ARS', 'chelsea': 'CHE', 'chelsea fc': 'CHE', 'liverpool': 'LIV', 'liverpool fc': 'LIV',
    'tottenham hotspur': 'TOT', 'tottenham': 'TOT', 'spurs': 'TOT', 'newcastle united': 'NEW', 'newcastle': 'NEW', 'newcastle utd': 'NEW',
    'aston villa': 'AVL', 'villa': 'AVL', 'west ham united': 'WHU', 'west ham': 'WHU', 'brighton & hove albion': 'BHA', 'brighton': 'BHA', 'brighton hove': 'BHA',
    'wolverhampton wanderers': 'WOL', 'wolverhampton': 'WOL', 'wolves': 'WOL', 'nottingham forest': 'NFO', 'nottm forest': 'NFO', 'nottingham': 'NFO',
    'leicester city': 'LEI', 'leicester': 'LEI', 'everton': 'EVE', 'everton fc': 'EVE', 'crystal palace': 'CRY', 'palace': 'CRY',
    'brentford': 'BRE', 'brentford fc': 'BRE', 'fulham': 'FUL', 'fulham fc': 'FUL', 'afc bournemouth': 'BOU', 'bournemouth': 'BOU',
    'southampton': 'SOU', 'saints': 'SOU', 'ipswich town': 'IPS', 'ipswich': 'IPS', 'real madrid': 'RMA', 'madrid': 'RMA',
    'barcelona': 'BAR', 'barca': 'BAR', 'fc barcelona': 'BAR', 'atletico madrid': 'ATM', 'atlético': 'ATM', 'atletico': 'ATM', 'atlético de madrid': 'ATM',
    'athletic club': 'ATH', 'athletic bilbao': 'ATH', 'athletic': 'ATH', 'real sociedad': 'RSO', 'sociedad': 'RSO', 'real betis': 'BET', 'betis': 'BET',
    'sevilla': 'SEV', 'sevilla fc': 'SEV', 'valencia': 'VAL', 'valencia cf': 'VAL', 'villarreal': 'VIL', 'villarreal cf': 'VIL',
    'celta vigo': 'CEL', 'celta': 'CEL', 'celta de vigo': 'CEL', 'girona': 'GIR', 'girona fc': 'GIR', 'osasuna': 'OSA', 'ca osasuna': 'OSA',
    'mallorca': 'MLL', 'rcd mallorca': 'MLL', 'juventus': 'JUV', 'juve': 'JUV', 'ac milan': 'MIL', 'milan': 'MIL',
    'inter milan': 'INT', 'inter': 'INT', 'internazionale': 'INT', 'ssc napoli': 'NAP', 'napoli': 'NAP', 'as roma': 'ROM', 'roma': 'ROM',
    'ss lazio': 'LAZ', 'lazio': 'LAZ', 'atalanta': 'ATA', 'atalanta bc': 'ATA', 'fiorentina': 'FIO', 'acf fiorentina': 'FIO',
    'bologna': 'BOL', 'bologna fc': 'BOL', 'torino': 'TOR', 'torino fc': 'TOR', 'bayern munich': 'BAY', 'bayern': 'BAY', 'fc bayern': 'BAY', 'bayern münchen': 'BAY',
    'borussia dortmund': 'BVB', 'dortmund': 'BVB', 'bayer 04 leverkusen': 'B04', 'leverkusen': 'B04', 'bayer leverkusen': 'B04',
    'rb leipzig': 'RBL', 'leipzig': 'RBL', 'eintracht frankfurt': 'SGE', 'frankfurt': 'SGE', 'eintracht': 'SGE',
    'borussia monchengladbach': 'BMG', 'gladbach': 'BMG', 'mgladbach': 'BMG', 'mönchengladbach': 'BMG', 'vfb stuttgart': 'VFB', 'stuttgart': 'VFB',
    'wolfsburg': 'WOB', 'vfl wolfsburg': 'WOB', 'sc freiburg': 'SCF', 'freiburg': 'SCF', 'union berlin': 'FCU', 'fc union berlin': 'FCU',
    'paris saint germain': 'PSG', 'psg': 'PSG', 'paris sg': 'PSG', 'paris saint-germain': 'PSG', 'olympique de marseille': 'MAR', 'marseille': 'MAR', 'om': 'MAR',
    'olympique lyonnais': 'LYO', 'lyon': 'LYO', 'ol': 'LYO', 'as monaco': 'ASM', 'monaco': 'ASM', 'lille osc': 'LOSC', 'lille': 'LOSC',
    'rc lens': 'RCL', 'lens': 'RCL', 'ogc nice': 'OGCN', 'nice': 'OGCN', 'ajax': 'AJA', 'afc ajax': 'AJA', 'psv eindhoven': 'PSV', 'psv': 'PSV',
    'feyenoord': 'FEY', 'sporting cp': 'SCP', 'sporting': 'SCP', 'sporting lisbon': 'SCP', 'sl benfica': 'SLB', 'benfica': 'SLB',
    'fc porto': 'FCP', 'porto': 'FCP', 'celtic': 'CEL', 'celtic fc': 'CEL', 'rangers': 'RAN', 'rangers fc': 'RAN', 'galatasaray': 'GAL', 'galatasaray sk': 'GAL',
    'fenerbahce': 'FEN', 'fenerbahçe': 'FEN', 'besiktas': 'BES', 'beşiktaş': 'BES', 'club brugge': 'BRU', 'boca juniors': 'BOC', 'river plate': 'RIV',
    'flamengo': 'FLA', 'palmeiras': 'PAL', 'al nassr': 'ALN', 'al hilal': 'ALH', 'inter miami': 'MIA',
    'argentina': 'ARG', 'brazil': 'BRA', 'brasil': 'BRA', 'france': 'FRA', 'england': 'ENG', 'spain': 'ESP', 'españa': 'ESP', 'germany': 'GER', 'deutschland': 'GER',
    'italy': 'ITA', 'italia': 'ITA', 'portugal': 'POR', 'netherlands': 'NED', 'holland': 'NED', 'belgium': 'BEL', 'croatia': 'CRO', 'uruguay': 'URU', 'colombia': 'COL',
    'united states': 'USA', 'usa': 'USA', 'usmnt': 'USA', 'mexico': 'MEX', 'nigeria': 'NGA', 'super eagles': 'NGA', 'senegal': 'SEN', 'morocco': 'MAR',
    'egypt': 'EGY', 'ghana': 'GHA', 'ivory coast': 'CIV', 'cote d\'ivoire': 'CIV', 'japan': 'JPN', 'south korea': 'KOR', 'korea republic': 'KOR'
};

const getLeagueHashtags = (leagueName: string) => {
    const map: Record<string, string> = {
        'Premier League': '#PremierLeague #EPL', 'La Liga': '#LaLiga', 'Bundesliga': '#Bundesliga', 'Serie A': '#SerieA',
        'Ligue 1': '#Ligue1', 'Champions League': '#UCL #ChampionsLeague', 'Europa League': '#UEL', 'World Cup': '#WorldCup #FIFAWorldCup', 'Euros': '#Euro2024 #UEFA'
    };
    return map[leagueName] || `#${String(leagueName).replace(/[^a-zA-Z0-9]/g, '')}`;
};

const getMatchHashtag = (home: string, away: string, league: string, homeTla?: string, awayTla?: string) => {
    const getTla = (name: string, fallbackTla?: string) => {
        const normalized = name.replace(/['"]/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (KNOWN_TEAMS[normalized]) return KNOWN_TEAMS[normalized];
        if (fallbackTla) return fallbackTla.toUpperCase();
        return name.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    };
    return `#${getTla(home, homeTla)}${getTla(away, awayTla)} ${getLeagueHashtags(league)} #Football #LiveScores`;
};

function encodeBase64Safe(obj: any) {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const getMatchImageUrl = (label: string, state: any, baseUrl: string) => {
    const payload = { type: 'versus', label: label, home: state.home_team, away: state.away_team, hScore: state.home_score, aScore: state.away_score, homeLogo: state.home_logo, awayLogo: state.away_logo };
    return `${baseUrl}/api/og?data=${encodeBase64Safe(payload)}`;
};

const getImageKitProxyUrl = (rawUrl: string) => {
    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT!.replace(/\/+$/, '');
    return `${endpoint}/tr:f-png/${encodeURIComponent(rawUrl)}`;
};

// 🟢 THE NEW TEMPLATE PARSER ENGINE
function parseTemplate(text: string, state: any, matchUrl: string, extra: any) {
    if (!text) return '';
    return text
        .replace(/\[HOME\]/g, state.home_team || '')
        .replace(/\[AWAY\]/g, state.away_team || '')
        .replace(/\[H_SCORE\]/g, state.home_score || 0)
        .replace(/\[A_SCORE\]/g, state.away_score || 0)
        .replace(/\[LINK\]/g, matchUrl)
        .replace(/\[TIME\]/g, extra.time || '')
        .replace(/\[SCORER\]/g, extra.scorer || '')
        .replace(/\[STATUS\]/g, extra.statusText || '')
        .replace(/\[CTA\]/g, extra.ctaText || '')
        .replace(/\[PRE_CTA\]/g, extra.preMatchCta || '')
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
    
    const config = settingsData?.social_config || {
        credentials: {}, vip_teams: [], vip_leagues: [], events: {}, templates: {}
    };

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
    const matchUrl = `${frontendUrl}/match/${newState.id}`; 
    const hashtags = getMatchHashtag(newState.home_team, newState.away_team, newState.league, newState.home_tla, newState.away_tla); 
    
    let ctaText = "👇 Match Stats & Updates:\n";
    let preMatchCta = "👇 See the tactical setup & subs here!\n";
    if (newState.media_url || newState.stream_url) {
        const isAudio = newState.media_mode === 'audio' || String(newState.media_url).includes('audio') || String(newState.media_url).includes('radio');
        if (isAudio) { ctaText = "🎧 Listen to Live Commentary:\n👇\n"; preMatchCta = "🎧 Live radio coverage begins at kick-off!\n👇\n"; } 
        else { ctaText = "📺 Watch Live Match Stream:\n👇\n"; preMatchCta = "📺 Live stream begins at kick-off!\n👇\n"; }
    }

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

    let eventKey = null;
    let extraData: any = { ctaText, preMatchCta, hashtags };
    let ogImageUrl = null;

    // -------------------------------------------------------------
    // 🚀 EVENT EVALUATION HIERARCHY
    // -------------------------------------------------------------
    if (!strictlyFinishedStatuses.includes(oldStatus) && strictlyFinishedStatuses.includes(newStatus)) {
        eventKey = 'fulltime';
        ogImageUrl = getMatchImageUrl('FULL TIME', newState, frontendUrl);
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
        if (!extraData.scorer) extraData.scorer = `\n⚽ GOAL - Confirmed! Tap the link below for full details!\n`;

        if (['PEN', 'PEN_SHOOT_OUT'].includes(newStatus)) ogImageUrl = getMatchImageUrl('PENALTY SCORED', newState, frontendUrl);
        else ogImageUrl = getMatchImageUrl('GOAL ALERT!', newState, frontendUrl); 
    } 
    else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length) {
        eventKey = 'penalty_awarded';
        const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
        extraData.time = sortedPens[0].time || sortedPens[0].minute ? `${sortedPens[0].time || sortedPens[0].minute}'` : '';
    } 
    else if (!htStatuses.includes(oldStatus) && htStatuses.includes(newStatus)) {
        eventKey = 'halftime';
    } 
    else if (htStatuses.includes(oldStatus) && (live1HStatuses.includes(newStatus) || live2HStatuses.includes(newStatus))) {
        eventKey = 'kickoff';
    } 
    else if (preStatuses.includes(oldStatus) && live1HStatuses.includes(newStatus)) {
        eventKey = 'kickoff';
        ogImageUrl = getMatchImageUrl('KICK-OFF', newState, frontendUrl);
    } 
    else if (oldWasIncomplete && newIsComplete) {
        eventKey = 'lineups';
        const lineupOg = { 
            type: 'pitch', label: 'STARTING XI', 
            home: newState.home_team, away: newState.away_team, 
            homeFormation: newState.lineups?.formations?.home || '4-3-3',
            awayFormation: newState.lineups?.formations?.away || '4-3-3',
            homeXI: newValidH.slice(0, 11), awayXI: newValidA.slice(0, 11)
        };
        ogImageUrl = `${frontendUrl}/api/og?data=${encodeBase64Safe(lineupOg)}`;
    }

    if (!eventKey) return NextResponse.json({ message: "No relevant trigger." });

    // -------------------------------------------------------------
    // 🚀 DYNAMIC MULTI-ACCOUNT BROADCASTER
    // -------------------------------------------------------------
    const evtConfig = config.events[eventKey] || {};
    const tpl = config.templates?.[eventKey] || {};

    const fb1Text = evtConfig.fb1 ? parseTemplate(tpl.fb1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]`, newState, matchUrl, extraData) : null;
    const fb2Text = evtConfig.fb2 ? parseTemplate(tpl.fb2 || fb1Text || '', newState, matchUrl, extraData) : null;
    const make1Text = evtConfig.make1 ? parseTemplate(tpl.make1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]\n[HASHTAGS]`, newState, matchUrl, extraData) : null;
    const make2Text = evtConfig.make2 ? parseTemplate(tpl.make2 || make1Text || '', newState, matchUrl, extraData) : null;
    const tgMsg = evtConfig.tg_general ? parseTemplate(tpl.tg_general || `<b>[HOME] [H_SCORE] - [A_SCORE] [AWAY]</b>\n<a href="[LINK]">Match Center</a>`, newState, matchUrl, extraData) : null;

    const creds = config.credentials || {};
    const proxiedImage = ogImageUrl ? getImageKitProxyUrl(ogImageUrl) : null;

    try {
        if (evtConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb1Text, x_text: make1Text, x_image_url: proxiedImage }) }).catch(()=>{});
        }
        if (evtConfig.make2 && creds.make_webhook_2) {
            await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb2Text, x_text: make2Text, x_image_url: proxiedImage }) }).catch(()=>{});
        }
        if (evtConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            const url = ogImageUrl ? `https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(ogImageUrl)}&message=${encodeURIComponent(fb1Text!)}&access_token=${token}` : `https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fb1Text!)}&access_token=${token}`;
            await fetch(url, { method: 'POST' }).catch(()=>{});
        }
        if (evtConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            const url = ogImageUrl ? `https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(ogImageUrl)}&message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}` : `https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`;
            await fetch(url, { method: 'POST' }).catch(()=>{});
        }
        if (evtConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
            for (const channel of creds.tg_general_channels) {
                await fetch(`https://api.telegram.org/bot${creds.telegram_bot_token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: channel.chatId, text: tgMsg, parse_mode: 'HTML', disable_web_page_preview: false }) }).catch(()=>{});
            }
        }

        fetch(`${frontendUrl}/api/index-url`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
            body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' })
        }).catch(() => {});

    } catch (err) { console.error("Critical error firing socials:", err); }

    return NextResponse.json({ success: true, event: eventKey });
}