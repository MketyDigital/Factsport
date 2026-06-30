// @ts-nocheck
export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Global cache for Edge isolate to prevent immediate concurrent duplicate processing
const edgeRecentPosts = new Set<string>();

const SAFETY_MAP: Record<string, any> = {
  goals: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, tg_general: false },
  lineups: { buf_x1: true, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, tg_general: false },
  kickoff: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, tg_general: false },
  fulltime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: true, make2: false, tg_general: false },
  halftime: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, tg_general: false },
  var_overturn: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, tg_general: false },
  penalty_awarded: { buf_x1: false, buf_x2: false, buf_fb1: false, buf_fb2: false, fb1: true, fb2: false, make1: false, make2: false, tg_general: false }
};

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'ABD', 'AET', 'AWARDED', 'PEN']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE', '1H', 'FIRST_HALF', 'FIRST HALF', '2H', 'SECOND_HALF', 'SECOND HALF']);
const HT_STATUSES = new Set(['HT', 'HALFTIME', 'HALF TIME', 'HALF-TIME', 'PAUSED']);
const PRE_STATUSES = new Set(['PRE_MATCH', 'SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD']);

const KNOWN_TEAMS: Record<string, string> = {
  'manchester city': 'MCI', 'man city': 'MCI', 'manchester united': 'MUN', 'man united': 'MUN', 'man utd': 'MUN',
  arsenal: 'ARS', chelsea: 'CHE', liverpool: 'LIV', 'tottenham hotspur': 'TOT', tottenham: 'TOT', spurs: 'TOT',
  'newcastle united': 'NEW', newcastle: 'NEW', 'aston villa': 'AVL', villa: 'AVL', 'west ham united': 'WHU', 'west ham': 'WHU',
  brighton: 'BHA', 'brighton & hove albion': 'BHA', 'wolverhampton wanderers': 'WOL', wolves: 'WOL', 'nottingham forest': 'NFO',
  'nottm forest': 'NFO', 'leicester city': 'LEI', everton: 'EVE', 'crystal palace': 'CRY', brentford: 'BRE', fulham: 'FUL',
  bournemouth: 'BOU', 'afc bournemouth': 'BOU', southampton: 'SOU', 'ipswich town': 'IPS',
  'real madrid': 'RMA', madrid: 'RMA', barcelona: 'BAR', barca: 'BAR', 'atletico madrid': 'ATM', 'athletic club': 'ATH',
  'real sociedad': 'RSO', 'real betis': 'BET', sevilla: 'SEV', valencia: 'VAL', villarreal: 'VIL', 'celta vigo': 'CEL',
  girona: 'GIR', osasuna: 'OSA', mallorca: 'MLL',
  juventus: 'JUV', juve: 'JUV', 'ac milan': 'MIL', milan: 'MIL', 'inter milan': 'INT', inter: 'INT', 'ssc napoli': 'NAP',
  napoli: 'NAP', 'as roma': 'ROM', roma: 'ROM', 'ss lazio': 'LAZ', lazio: 'LAZ', atalanta: 'ATA', fiorentina: 'FIO',
  bologna: 'BOL', torino: 'TOR',
  'bayern munich': 'BAY', bayern: 'BAY', 'borussia dortmund': 'BVB', dortmund: 'BVB', 'bayer leverkusen': 'B04', leverkusen: 'B04',
  'rb leipzig': 'RBL', leipzig: 'RBL', 'eintracht frankfurt': 'SGE', frankfurt: 'SGE', 'borussia monchengladbach': 'BMG', gladbach: 'BMG',
  'vfb stuttgart': 'VFB', stuttgart: 'VFB', wolfsburg: 'WOB', 'sc freiburg': 'SCF', freiburg: 'SCF', 'fc union berlin': 'FCU', 'union berlin': 'FCU',
  'paris saint germain': 'PSG', psg: 'PSG', 'olympique de marseille': 'MAR', marseille: 'MAR', om: 'MAR',
  'olympique lyon': 'LYO', lyon: 'LYO', ol: 'LYO', 'as monaco': 'ASM', monaco: 'ASM', 'lille osc': 'LOSC', lille: 'LOSC',
  'rc lens': 'RCL', lens: 'RCL', 'ogc nice': 'OGCN', nice: 'OGCN',
  ajax: 'AJA', 'psv eindhoven': 'PSV', psv: 'PSV', feyenoord: 'FEY',
  'sporting cp': 'SCP', sporting: 'SCP', 'sl benfica': 'SLB', benfica: 'SLB', 'fc porto': 'FCP', porto: 'FCP',
  celtic: 'CEL', rangers: 'RAN', galatasaray: 'GAL', fenerbahce: 'FEN', fenerbahçe: 'FEN', besiktas: 'BES', beşiktaş: 'BES',
  'club brugge': 'BRU', 'boca juniors': 'BOC', 'river plate': 'RIV', flamengo: 'FLA', palmeiras: 'PAL',
  'al nassr': 'ALN', 'al hilal': 'ALH', 'inter miami': 'MIA',
  argentina: 'ARG', brazil: 'BRA', brasil: 'BRA', france: 'FRA', england: 'ENG', spain: 'ESP', italy: 'ITA', germany: 'GER',
  deutschland: 'GER', portugal: 'POR', netherlands: 'NED', holland: 'NED', belgium: 'BEL', croatia: 'CRO', uruguay: 'URU',
  colombia: 'COL', usa: 'USA', 'united states': 'USA', usmnt: 'USA', uswnt: 'USA', mexico: 'MEX', senegal: 'SEN', morocco: 'MAR',
  japan: 'JPN', 'south korea': 'KOR', 'korea republic': 'KOR', korea: 'KOR', switzerland: 'SUI', denmark: 'DEN', sweden: 'SWE',
  poland: 'POL', wales: 'WAL', scotland: 'SCO', ireland: 'IRL', 'republic of ireland': 'IRL', norway: 'NOR', austria: 'AUT',
  hungary: 'HUN', serbia: 'SRB', turkey: 'TUR', ukraine: 'UKR', 'czech republic': 'CZE', czechia: 'CZE', greece: 'GRE',
  romania: 'ROU', chile: 'CHI', peru: 'PER', ecuador: 'ECU', paraguay: 'PAR', venezuela: 'VEN', bolivia: 'BOL', canada: 'CAN',
  'costa rica': 'CRC', panama: 'PAN', jamaica: 'JAM', nigeria: 'NGA', egypt: 'EGY', cameroon: 'CMR', ghana: 'GHA',
  'ivory coast': 'CIV', "cote d'ivoire": 'CIV', "côte d'ivoire": 'CIV', algeria: 'ALG', tunisia: 'TUN', mali: 'MLI',
  iran: 'IRN', iraq: 'IRQ', australia: 'AUS', 'saudi arabia': 'KSA', qatar: 'QAT', uzbekistan: 'UZB', oman: 'OMA',
  jordan: 'JOR', bahrain: 'BHR', kyrgyzstan: 'KGZ', indonesia: 'IDN', malaysia: 'MYS', thailand: 'THA', vietnam: 'VNM',
  'united arab emirates': 'UAE', uae: 'UAE', 'south africa': 'RSA', 'cape verde': 'CPV', 'cabo verde': 'CPV',
  'dr congo': 'COD', 'congo dr': 'COD', 'bosnia and herzegovina': 'BIH', bosnia: 'BIH', slovakia: 'SVK', slovenia: 'SVN',
  albania: 'ALB', georgia: 'GEO', 'new zealand': 'NZL'
};

const getTla = (name: string, fallbackTla?: string) => {
  if (!name) return 'TM';
  const normalized = name.replace(/['"]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (KNOWN_TEAMS[normalized]) return KNOWN_TEAMS[normalized];
  if (fallbackTla) return fallbackTla.toUpperCase();
  return name.replace(/ fc| cf| united| city/ig, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
};

const getLeagueHashtags = (leagueName: string) => {
  const map: Record<string, string> = {
    'Premier League': '#PremierLeague #EPL', 'La Liga': '#LaLiga', Bundesliga: '#Bundesliga', 'Serie A': '#SerieA',
    'Ligue 1': '#Ligue1', 'Champions League': '#UCL #ChampionsLeague', 'Europa League': '#UEL #EuropaLeague',
    'Europa Conference League': '#UECL #ConferenceLeague', 'FA Cup': '#FACup', 'Carabao Cup': '#CarabaoCup #EFLCup',
    'Copa del Rey': '#CopaDelRey', 'Coppa Italia': '#CoppaItalia', 'Coupe de France': '#CoupeDeFrance',
    'DFB-Pokal': '#DFBPokal', 'World Cup': '#WorldCup #FIFAWorldCup', Euros: '#EURO2024 #Euro',
    'Copa America': '#CopaAmerica', AFCON: '#AFCON', 'UEFA Nations League': '#NationsLeague',
    'CONCACAF Nations League': '#ConcacafNationsLeague'
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
  const lastName = nameCleaned ? nameCleaned.split(' ')?.pop() : '';
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
    .replace(/\[HASHTAGS\]/g, extra.hashtags || '')
    .replace(/\[STAKES\]/g, extra.stakes || '')
    .replace(/\[ROUND\]/g, extra.round || '')
    .replace(/\[GROUP\]/g, extra.group || '');
}

const secureStaticImage = async (internalFetchUrl: string, publicFallbackUrl: string, fileName: string, supabaseClient: any) => {
  if (!internalFetchUrl) return '';
  try {
    const imgResponse = await fetch(internalFetchUrl, { headers: { Accept: 'image/png' } });
    let arrayBuffer;
    if (imgResponse.ok) {
      arrayBuffer = await imgResponse.arrayBuffer();
    } else {
      const fallbackRes = await fetch(publicFallbackUrl);
      if (!fallbackRes.ok) return '';
      arrayBuffer = await fallbackRes.arrayBuffer();
    }
    const { error } = await supabaseClient.storage.from('socials').upload(`${fileName}.png`, arrayBuffer, {
      contentType: 'image/png', upsert: true
    });
    if (error) return publicFallbackUrl;
    const { data } = supabaseClient.storage.from('socials').getPublicUrl(`${fileName}.png`);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch { return publicFallbackUrl; }
};

const isLineupsEvent = (eventKey: string | null) => eventKey === 'lineups';

const normalizeLineupsEventConfig = (eventKey: string | null, evtConfig: any) => {
  if (!isLineupsEvent(eventKey)) return evtConfig;
  return { ...evtConfig, make1: !!evtConfig.make1, buf_x1: !!evtConfig.buf_x1, fb1: !!evtConfig.fb1, buf_x2: false, buf_fb1: false, buf_fb2: false, fb2: false, make2: false, tg_general: false };
};

const fetchImageArrayBuffer = async (url: string) => {
  try {
    const imgResponse = await fetch(url, { headers: { Accept: 'image/png' } });
    if (!imgResponse.ok) return null;
    return await imgResponse.arrayBuffer();
  } catch { return null; }
};

const uploadImageArrayBuffer = async (arrayBuffer: ArrayBuffer, fileName: string, supabaseClient: any) => {
  try {
    const { error } = await supabaseClient.storage.from('socials').upload(`${fileName}.png`, arrayBuffer, {
      contentType: 'image/png', upsert: true
    });
    if (error) return '';
    const { data } = supabaseClient.storage.from('socials').getPublicUrl(`${fileName}.png`);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch { return ''; }
};

const generateStaticImage = async (internalFetchUrl: string, fileName: string, supabaseClient: any) => {
  const arrayBuffer = await fetchImageArrayBuffer(internalFetchUrl);
  if (!arrayBuffer) return { ok: false, url: '' };
  const publicUrl = await uploadImageArrayBuffer(arrayBuffer, fileName, supabaseClient);
  return { ok: !!publicUrl, url: publicUrl };
};

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
  const str = String(t || '').replace(/[^0-9+]/g, '');
  const parts = str.split('+');
  return parseInt(parts[0] || '0') * 100 + parseInt(parts[1] || '0');
};

const parseMinutes = (t: any) => {
  const str = String(t || '').replace(/[^0-9+]/g, '');
  const parts = str.split('+');
  return parseInt(parts[0] || '0') + parseInt(parts[1] || '0');
};

const isTerminalStatus = (status: any) => TERMINAL_STATUSES.has(String(status || '').toUpperCase());
const isLiveStatus = (status: any) => LIVE_STATUSES.has(String(status || '').toUpperCase());
const isHtStatus = (status: any) => HT_STATUSES.has(String(status || '').toUpperCase());
const isPreStatus = (status: any) => PRE_STATUSES.has(String(status || '').toUpperCase());

const isEventFresh = (event: any, matchDate: string, freshnessMs = 20 * 60 * 1000) => {
  if (!event) return true;
  if (!matchDate) return true;

  const kickMs = Date.parse(matchDate);
  if (!Number.isFinite(kickMs)) return true;

  let elapsedMinutes = parseMinutes(event.time || event.minute);
  if (elapsedMinutes > 45) elapsedMinutes += 15;

  const eventMs = kickMs + elapsedMinutes * 60000;
  const age = Date.now() - eventMs;
  const maxAgeMs = Math.max(freshnessMs, 20 * 60 * 1000);
  return age <= maxAgeMs && age >= -maxAgeMs;
};

const getLatestChangedGoal = (oldGoals: any[], newGoals: any[]) => {
  const oldKeys = new Set(oldGoals.map((g) => `${g.time || ''}|${g.player || ''}|${g.text || ''}`));
  const sorted = [...newGoals].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
  return sorted.find((g) => !oldKeys.has(`${g.time || ''}|${g.player || ''}|${g.text || ''}`)) || sorted[0] || null;
};

const getCompetitionStakes = (match: any) => {
  const league = String(match.league || '').toLowerCase();
  const stage = String(match.stage || '').toLowerCase();
  const matchType = String(match.match_type || '').toLowerCase();
  const group = String(match.match_group || match.group || '').replace(/_/g, ' ');

  const homeWins = Number(match.home_score) > Number(match.away_score);
  const awayWins = Number(match.away_score) > Number(match.home_score);
  const winner = homeWins ? match.home_team : awayWins ? match.away_team : null;
  const combined = `${league} ${stage} ${matchType} ${group}`.toLowerCase();

  if (combined.includes('final')) return { short: 'Cup Final', full: winner ? `${winner} wins the cup` : 'Cup final decided', round: 'Final', group: '' };
  if (combined.includes('semi')) return { short: 'Semi-final', full: winner ? `${winner} advances to the final` : 'Semi-final winner advances', round: 'Semi-final', group: '' };
  if (combined.includes('quarter')) return { short: 'Quarter-final', full: winner ? `${winner} advances to the semi-finals` : 'Quarter-final winner advances', round: 'Quarter-final', group: '' };
  if (combined.includes('round of')) return { short: 'Knockout Round', full: winner ? `${winner} advances to the next round` : 'Knockout winner advances', round: 'Knockout Round', group: '' };
  if (combined.includes('group')) return { short: 'Group Stage', full: group ? `Group ${group} points can decide qualification.` : 'Group-stage points can decide qualification.', round: 'Group Stage', group: group || '' };
  return { short: league || 'Football', full: '', round: '', group: '' };
};

const getOgLabel = (eventKey: string, match: any, stakes: any) => {
  if (eventKey === 'fulltime') {
    if (stakes.short === 'Cup Final') return 'CUP FINAL FULL TIME';
    if (stakes.short === 'Semi-final') return 'SEMI-FINAL FULL TIME';
    if (stakes.short === 'Quarter-final') return 'QUARTER-FINAL FULL TIME';
    if (stakes.short === 'Group Stage') return 'GROUP STAGE FULL TIME';
    return 'FULL TIME';
  }
  if (eventKey === 'goals') return 'GOAL ALERT!';
  if (eventKey === 'lineups') return 'STARTING XI';
  if (eventKey === 'kickoff') return 'KICK-OFF';
  if (eventKey === 'halftime') return 'HALF TIME';
  if (eventKey === 'var_overturn') return 'VAR DECISION';
  if (eventKey === 'penalty_awarded') return 'PENALTY AWARDED';
  return 'MATCH UPDATE';
};

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_KEY}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const newState = body.record;
  const oldState = body.old_record || { home_score: 0, away_score: 0, status: 'PRE_MATCH', lineups: { home: [], away: [] }, match_events: [] };

  if (!newState) return NextResponse.json({ message: 'No record found' }, { status: 400 });

  const oldStatus = String(oldState.status).toUpperCase();
  const newStatus = String(newState.status).toUpperCase();

  if (isTerminalStatus(oldStatus) && isTerminalStatus(newStatus)) {
    return NextResponse.json({ message: 'Match already finished. Ignoring late correction.' });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
  const config = settingsData?.social_config || { credentials: {}, vip_teams: [], vip_leagues: [], events: {}, templates: {} };

  const HARDCODED_VIP_LEAGUES = [
    'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 
    'Champions League', 'Europa League', 'Europa Conference League', 
    'FA Cup', 'Carabao Cup', 'Copa del Rey', 'Coppa Italia', 'Coupe de France', 
    'DFB-Pokal', 'World Cup', 'Euros', 'Copa America', 'AFCON', 
    'UEFA Nations League', 'CONCACAF Nations League'
  ];
  const HARDCODED_VIP_TEAMS = [
    'Arsenal', 'Aston Villa', 'Chelsea', 'Everton', 'Liverpool', 'Manchester City', 'Man City', 'Manchester United', 'Man Utd', 'Newcastle United', 'Tottenham Hotspur', 'Spurs', 
    'Real Madrid', 'Barcelona', 'Atletico Madrid', 
    'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 
    'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 
    'Paris Saint Germain', 'PSG', 'Marseille', 'Lyon',
    'Argentina', 'Brazil', 'France', 'England', 'Spain', 'Italy', 'Germany', 'Portugal', 'Netherlands', 'Belgium', 'Uruguay', 'Colombia', 'USA', 'Mexico', 'Senegal', 'Morocco', 'Nigeria'
  ];

  const mergedVipTeams = [...(config.vip_teams || []), ...HARDCODED_VIP_TEAMS];
  const mergedVipLeagues = [...(config.vip_leagues || []), ...HARDCODED_VIP_LEAGUES];

  const homeTeamStr = String(newState.home_team || '').toLowerCase();
  const awayTeamStr = String(newState.away_team || '').toLowerCase();
  const leagueStr = String(newState.league || '').toLowerCase();

  const isVipTeam = mergedVipTeams.some(t => homeTeamStr.includes(t.toLowerCase()) || awayTeamStr.includes(t.toLowerCase()));
  const isVipLeague = mergedVipLeagues.some(l => leagueStr === l.toLowerCase() || leagueStr.includes(l.toLowerCase()));
  let isVIP = isVipTeam || isVipLeague;
  
  if (!isVIP) {
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysMatches } = await supabase.from('matches').select('id, home_team, away_team, league').like('match_date', `${today}%`).order('match_date', { ascending: true });
    const hasVIPToday = todaysMatches?.some((m) => mergedVipTeams.some(t => m.home_team?.toLowerCase().includes(t.toLowerCase()) || m.away_team?.toLowerCase().includes(t.toLowerCase())) || mergedVipLeagues.some(l => m.league?.toLowerCase().includes(l.toLowerCase())));
    if (hasVIPToday) return NextResponse.json({ message: 'Not a VIP team or league.' });
    if (todaysMatches && todaysMatches.length > 0 && newState.id === todaysMatches[0].id) {
      isVIP = true;
    } else {
      return NextResponse.json({ message: 'Not the fallback match.' });
    }
  }

  const frontendUrl = 'https://factsport.com';
  const internalOrigin = new URL(request.url).origin;
  const matchUrl = `${frontendUrl}/match/${newState.id}`;
  const stakes = getCompetitionStakes(newState);
  const hashtags = `#${getTla(newState.home_team, newState.home_tla)} #${getTla(newState.away_team, newState.away_tla)} ${getLeagueHashtags(newState.league)} #Football`;

  let ctaText = '👇 Match Stats & Updates:\n';
  let preMatchCta = '👇 See tactical setup & subs:\n';

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
  let newGoalsList = getValidGoals(newState.match_events || []);
  const oldPenaltiesList = getPenaltyEvents(oldState.match_events || []);
  const newPenaltiesList = getPenaltyEvents(newState.match_events || []);

  const getValidNames = (arr: any[]) => (Array.isArray(arr) ? arr : []).map((p) => p?.name || p?.player?.name || p?.playerName || (typeof p === 'string' ? p : null)).filter(Boolean);
  const oldValidH = getValidNames(oldState.lineups?.home);
  const oldValidA = getValidNames(oldState.lineups?.away);
  const newValidH = getValidNames(newState.lineups?.home);
  const newValidA = getValidNames(newState.lineups?.away);

  const oldHasFullLineups = oldValidH.length >= 11 && oldValidA.length >= 11;
  const newHasFullLineups = newValidH.length >= 11 && newValidA.length >= 11;

  let eventKey: string | null = null;
  let extraData: any = { ctaText, preMatchCta, hashtags, stakes: stakes.full, round: stakes.round, group: stakes.group };
  let ogPayload = null;

  if (!isTerminalStatus(oldStatus) && isTerminalStatus(newStatus)) {
    eventKey = 'fulltime';
    ogPayload = {
      type: 'versus', label: getOgLabel(eventKey, newState, stakes), home: newState.home_team, away: newState.away_team,
      hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo,
      homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla)
    };
  } else if (newTotal < oldTotal && !isTerminalStatus(newStatus)) {
    const kickMs = Date.parse(newState.match_date);
    const hoursSinceKickoff = (Date.now() - kickMs) / (1000 * 60 * 60);
    if (hoursSinceKickoff < 5) {
      eventKey = 'var_overturn';
    }
  } else if (newTotal > oldTotal && !isTerminalStatus(newStatus)) {
    eventKey = 'goals';
    extraData.statusText = isLiveStatus(newStatus) ? '' : ` (${newState.status})`;
    
    let latestGoal = getLatestChangedGoal(oldGoalsList, newGoalsList);
    
    if (newGoalsList.length < newTotal || !latestGoal) {
      // 8-second delay allows the DB to catch up via another webhook while this function waits
      await new Promise(resolve => setTimeout(resolve, 8000));
      const { data: freshMatch } = await supabase.from('matches').select('match_events').eq('id', newState.id).single();
      if (freshMatch) {
          newGoalsList = getValidGoals(freshMatch.match_events || []);
          latestGoal = getLatestChangedGoal(oldGoalsList, newGoalsList);
      }
    }
    
    if (!latestGoal) {
      extraData.scorer = '\n⚽ GOAL!\n';
    } else {
      if (!isEventFresh(latestGoal, newState.match_date)) {
        return NextResponse.json({ message: 'Goal event is stale. Ignoring late goal trigger.' });
      }
      const player = latestGoal.player || latestGoal.playerName || latestGoal.name;
      const time = latestGoal.time || latestGoal.minute ? `${latestGoal.time || latestGoal.minute}' ` : '';
      
      if (player) {
          extraData.scorer = `\n⚽ GOAL - ${player} ${time ? `(${time.trim()})` : ''}\n`;
      } else {
          extraData.scorer = `\n⚽ GOAL! ${time ? `(${time.trim()})` : ''}\n`;
      }
    }

    ogPayload = {
      type: 'versus', label: ['PEN', 'PEN_SHOOT_OUT'].includes(newStatus) ? 'PENALTY SCORED' : 'GOAL ALERT!',
      home: newState.home_team, away: newState.away_team, hScore: newState.home_score, aScore: newState.away_score,
      homeLogo: newState.home_logo, awayLogo: newState.away_logo, homeTla: getTla(newState.home_team, newState.home_tla),
      awayTla: getTla(newState.away_team, newState.away_tla)
    };
  } else if (newTotal === oldTotal && newPenaltiesList.length > oldPenaltiesList.length && !isTerminalStatus(newStatus)) {
    const sortedPens = [...newPenaltiesList].sort((a, b) => parseTime(b.time || b.minute) - parseTime(a.time || a.minute));
    const latestPenalty = sortedPens[0];
    if (latestPenalty && isEventFresh(latestPenalty, newState.match_date)) {
      eventKey = 'penalty_awarded';
      extraData.time = latestPenalty.time || latestPenalty.minute ? `${latestPenalty.time || latestPenalty.minute}'` : '';
    }
  } else if (!isHtStatus(oldStatus) && isHtStatus(newStatus)) {
    eventKey = 'halftime';
    ogPayload = {
      type: 'versus', label: 'HALF TIME', home: newState.home_team, away: newState.away_team,
      hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo,
      homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla)
    };
  } else if (isHtStatus(oldStatus) && (isLiveStatus(newStatus) || isPreStatus(newStatus))) {
    eventKey = 'kickoff';
  } else if (isPreStatus(oldStatus) && isLiveStatus(newStatus)) {
    eventKey = 'kickoff';
    ogPayload = {
      type: 'versus', label: 'KICK-OFF', home: newState.home_team, away: newState.away_team,
      hScore: newState.home_score, aScore: newState.away_score, homeLogo: newState.home_logo, awayLogo: newState.away_logo,
      homeTla: getTla(newState.home_team, newState.home_tla), awayTla: getTla(newState.away_team, newState.away_tla)
    };
  } else if (!oldHasFullLineups && newHasFullLineups) {
    eventKey = 'lineups';
    ogPayload = {
      type: 'pitch', label: 'STARTING XI', home: newState.home_team, away: newState.away_team,
      homeFormation: newState.lineups?.formations?.home || '4-3-3', awayFormation: newState.lineups?.formations?.away || '4-3-3',
      homeXI: newValidH.slice(0, 11).map(compressPlayerName), awayXI: newValidA.slice(0, 11).map(compressPlayerName)
    };
  }

  if (eventKey === 'goals') eventKey = `goals_${newTotal}`;
  if (eventKey === 'var_overturn') eventKey = `var_overturn_${newTotal}`;
  if (eventKey === 'penalty_awarded') eventKey = `penalty_awarded_${newPenaltiesList.length}`;

  if (!eventKey) return NextResponse.json({ message: 'No relevant trigger.' });

  const uniqueEventIdentifier = `${newState.id}_${eventKey}`;
  if (edgeRecentPosts.has(uniqueEventIdentifier)) {
    return NextResponse.json({ message: 'Event already processing/processed concurrently (caught by Edge cache).' });
  }
  edgeRecentPosts.add(uniqueEventIdentifier);
  setTimeout(() => edgeRecentPosts.delete(uniqueEventIdentifier), 90000);

  const baseEventKey = eventKey.replace(/_\d+$/, '');
  const baseSafetyConfig = SAFETY_MAP[baseEventKey] || {};
  const dbEventConfig = config.events?.[baseEventKey] || {};
  let evtConfig = { ...baseSafetyConfig, ...dbEventConfig };

  evtConfig = normalizeLineupsEventConfig(baseEventKey, evtConfig);
  const tpl = config.templates?.[baseEventKey] || {};

  extraData.activeCta = baseEventKey === 'lineups' || baseEventKey === 'kickoff' ? preMatchCta : ctaText;

  const fb1Text = evtConfig.fb1 ? parseTemplate(tpl.fb1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[STAKES]\n[LINK]`, newState, matchUrl, extraData) : null;
  const fb2Text = evtConfig.fb2 ? parseTemplate(tpl.fb2 || fb1Text || '', newState, matchUrl, extraData) : null;
  const make1Text = evtConfig.make1 ? parseTemplate(tpl.make1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]\n[HASHTAGS]`, newState, matchUrl, extraData) : null;
  const make2Text = evtConfig.make2 ? parseTemplate(tpl.make2 || make1Text || '', newState, matchUrl, extraData) : null;
  const tgMsg = evtConfig.tg_general ? parseTemplate(tpl.tg_general || `<b>[HOME] [H_SCORE] - [A_SCORE] [AWAY]</b>\n[STAKES]\n<a href="[LINK]">Match Center</a>`, newState, matchUrl, extraData) : null;
  const bufX1Text = evtConfig.buf_x1 ? parseTemplate(tpl.buf_x1 || tpl.make1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]\n[HASHTAGS]`, newState, matchUrl, extraData) : null;
  const bufX2Text = evtConfig.buf_x2 ? parseTemplate(tpl.buf_x2 || tpl.make2 || bufX1Text || '', newState, matchUrl, extraData) : null;
  const bufFb1Text = evtConfig.buf_fb1 ? parseTemplate(tpl.buf_fb1 || tpl.fb1 || `[HOME] [H_SCORE] - [A_SCORE] [AWAY]\n[LINK]`, newState, matchUrl, extraData) : null;
  const bufFb2Text = evtConfig.buf_fb2 ? parseTemplate(tpl.buf_fb2 || tpl.fb2 || bufFb1Text || '', newState, matchUrl, extraData) : null;

  const creds = config.credentials || {};

  try {
    const bufferToken = creds.buffer_token || process.env.BUFFER_ACCESS_TOKEN;
    let finalStaticImage = '';
    let imageGenerationOk = false;

    if (ogPayload) {
      const payloadEncoded = encodeBase64Safe(ogPayload);
      const internalFetchUrl = `${internalOrigin}/api/og?data=${payloadEncoded}`;
      const publicFallbackUrl = `${frontendUrl}/api/og?data=${payloadEncoded}`;
      const timestampKey = `match_${newState.id}_evt_${eventKey}_ts_${Date.now()}`;

      if (isLineupsEvent(eventKey)) {
        const result = await generateStaticImage(internalFetchUrl, timestampKey, supabase);
        if (result.ok && result.url) {
          finalStaticImage = result.url;
          imageGenerationOk = true;
        } else {
          finalStaticImage = '';
          imageGenerationOk = false;
          console.error(`Lineups OG image generation/upload failed. Posting text-only for match ${newState.id}.`);
        }
      } else {
        finalStaticImage = await secureStaticImage(internalFetchUrl, publicFallbackUrl, timestampKey, supabase);
        imageGenerationOk = !!finalStaticImage;
      }
    }

    const makePayload1: any = { fb2_text: fb1Text, x_text: make1Text, buf_x_text: bufX1Text, buf_fb_text: bufFb1Text };
    if (finalStaticImage) makePayload1.x_image_url = finalStaticImage;

    const makePayload2: any = { fb2_text: fb2Text, x_text: make2Text, buf_x_text: bufX2Text, buf_fb_text: bufFb2Text };
    if (finalStaticImage) makePayload2.x_image_url = finalStaticImage;

    const stripImageFromMakePayload = (payload: any) => {
      const cloned = JSON.parse(JSON.stringify(payload || {}));
      delete cloned.x_image_url;
      return cloned;
    };

    const bufferPostFailed = (result: any) => {
      if (!result || result.ok === false) return true;
      const data = result.json?.data;
      if (Array.isArray(result.json?.errors)) return true;
      if (data?.createPost?.__typename === 'MutationError') return true;
      return false;
    };

    const postToBufferDirectly = async (text: string, safeImgUrl: string, profileId: string, token: string, allowImage = true) => {
      const payload = {
        query: 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }',
        variables: {
          input: {
            text: text || '', channelId: profileId, schedulingType: 'automatic', mode: 'shareNow',
            assets: allowImage && imageGenerationOk && safeImgUrl && safeImgUrl.length > 5 ? [{ image: { url: safeImgUrl } }] : []
          }
        }
      };
      const res = await fetch('https://api.buffer.com/1/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      let json: any = {};
      try { json = await res.json(); } catch { json = {}; }
      return { ok: res.ok, json };
    };

    const postToBufferWithRetry = async (text: string, safeImgUrl: string, profileId: string, token: string) => {
      const result = await postToBufferDirectly(text, safeImgUrl, profileId, token, true);
      if (isLineupsEvent(eventKey) && bufferPostFailed(result)) {
        await postToBufferDirectly(text, '', profileId, token, false);
      }
    };

    const postToMake = async (url: string, payload: any) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let text = '';
      try { text = await res.text(); } catch { text = ''; }
      return { ok: res.ok, text };
    };

    const postToMakeWithRetry = async (url: string, payload: any) => {
      const result = await postToMake(url, payload);
      if (isLineupsEvent(eventKey) && !result.ok) {
        await postToMake(url, stripImageFromMakePayload(payload));
      }
    };

    const postToFbWithRetry = async (pageId: string, token: string, message: string, imageUrl: string) => {
      const feedUrl = `https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(message)}&access_token=${token}`;
      if (imageUrl) {
        const photoUrl = `https://graph.facebook.com/v19.0/${pageId}/photos?url=${encodeURIComponent(imageUrl)}&message=${encodeURIComponent(message)}&access_token=${token}`;
        const photoRes = await fetch(photoUrl, { method: 'POST' });
        if (!photoRes.ok && isLineupsEvent(eventKey)) {
          await fetch(feedUrl, { method: 'POST' }).catch(() => {});
        }
      } else {
        await fetch(feedUrl, { method: 'POST' }).catch(() => {});
      }
    };

    if (evtConfig.buf_x1 && bufferToken && creds.buffer_x1_id) {
      await postToBufferWithRetry(bufX1Text!, finalStaticImage, creds.buffer_x1_id, bufferToken);
    }
    if (evtConfig.buf_x2 && bufferToken && creds.buffer_x2_id) {
      await postToBufferWithRetry(bufX2Text!, finalStaticImage, creds.buffer_x2_id, bufferToken);
    }
    if (evtConfig.buf_fb1 && bufferToken && creds.buffer_fb1_id) {
      await postToBufferWithRetry(bufFb1Text!, finalStaticImage, creds.buffer_fb1_id, bufferToken);
    }
    if (evtConfig.buf_fb2 && bufferToken && creds.buffer_fb2_id) {
      await postToBufferWithRetry(bufFb2Text!, finalStaticImage, creds.buffer_fb2_id, bufferToken);
    }

    if (evtConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
      const pageId = creds.fb1_id || process.env.FB_PAGE_ID;
      const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
      await postToFbWithRetry(pageId, token, fb1Text || '', finalStaticImage);
    }

    if (evtConfig.fb2 && creds.fb2_id && creds.fb2_token) {
      const url = finalStaticImage
        ? `https://graph.facebook.com/v19.0/${creds.fb2_id}/photos?url=${encodeURIComponent(finalStaticImage)}&message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`
        : `https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fb2Text!)}&access_token=${creds.fb2_token}`;
      await fetch(url, { method: 'POST' }).then(async (r) => { if (!r.ok) console.error('FB2 Error:', await r.text()); }).catch(() => {});
    }

    if (evtConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
      await postToMakeWithRetry(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, makePayload1);
    }

    if (evtConfig.make2 && creds.make_webhook_2) {
      await postToMakeWithRetry(creds.make_webhook_2, makePayload2);
    }

    if (evtConfig.tg_general && creds.telegram_bot_token && creds.tg_general_channels) {
      for (const channel of creds.tg_general_channels) {
        await fetch(`https://api.telegram.org/bot${creds.telegram_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: channel.chatId, text: tgMsg, parse_mode: 'HTML', disable_web_page_preview: false })
        }).catch(() => {});
      }
    }

    fetch(`${frontendUrl}/api/index-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_KEY}` },
      body: JSON.stringify({ url: matchUrl, type: 'URL_UPDATED' })
    }).catch(() => {});

  } catch (err) {
    console.error('Critical error firing socials:', err);
  }

  return NextResponse.json({ success: true, event: eventKey });
}