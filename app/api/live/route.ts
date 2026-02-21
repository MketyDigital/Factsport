export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails } from '@/app/lib/espn';

// 🟢 1. THE ULTIMATE MASTER DICTIONARY
const getCanonicalName = (rawName: string) => {
    if (!rawName) return "";
    
    // The Super-Stripper: Removes accents, punctuation, and ALL club prefixes/suffixes
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|ac|acf|bc|losc|ogc|sco|jk|sk|cp|srl)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    // The Unbreakable Alias Database
    const aliases: Record<string, string> = {
        'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
        'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
        'wolverhampton': 'wolverhampton wanderers', 'nottm forest': 'nottingham forest', 'nottm': 'nottingham forest',
        'sheff utd': 'sheffield united', 'brighton hove albion': 'brighton', 'brighton hove': 'brighton', 
        'west ham united': 'west ham', 'newcastle united': 'newcastle', 'leicester city': 'leicester',
        'palace': 'crystal palace', 'saints': 'southampton', 'qpr': 'queens park rangers',
        
        'atleti': 'atletico madrid', 'sociedad': 'real sociedad', 'betis': 'real betis',
        'athletic': 'athletic club', 'athletic bilbao': 'athletic club', 'bilbao': 'athletic club',
        'osasuna': 'ca osasuna', 'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 
        'espanyol barcelona': 'espanyol', 'real valladolid': 'valladolid', 'deportivo alaves': 'alaves', 
        'sevilla fc': 'sevilla', 'getafe cf': 'getafe', 'villarreal cf': 'villarreal', 'barca': 'barcelona',
        
        '1 koln': 'fc cologne', 'koln': 'fc cologne', 'cologne': 'fc cologne',
        'bayern': 'bayern munich', 'bayern munchen': 'bayern munich', 'bvb': 'borussia dortmund',
        'dortmund': 'borussia dortmund', 'gladbach': 'borussia monchengladbach', 'mgladbach': 'borussia monchengladbach',
        'borussia mgladbach': 'borussia monchengladbach', 'leverkusen': 'bayer leverkusen', 'leipzig': 'rb leipzig', 
        'frankfurt': 'eintracht frankfurt', 'stuttgart': 'vfb stuttgart', 'mainz': 'mainz 05', 'hoff': 'tsg hoffenheim',
        'hoffenheim': 'tsg hoffenheim', 'union berlin': 'fc union berlin', 'werder bremen': 'sv werder bremen',
        'freiburg': 'sc freiburg', 'wolfsburg': 'vfl wolfsburg', 'bochum': 'vfl bochum',
        'st pauli': 'sankt pauli', 'fc st pauli': 'sankt pauli',
        
        'juve': 'juventus', 'inter': 'inter milan', 'internazionale': 'inter milan',
        'milan': 'ac milan', 'roma': 'as roma', 'lazio': 'ss lazio',
        'napoli': 'ssc napoli', 'hellas verona': 'verona', 'genoa': 'genoa', 
        'genoa cfc': 'genoa', 'lecce': 'us lecce', 'us lecce': 'lecce', 
        'torino': 'torino', 'torino fc': 'torino', 'cagliari': 'cagliari', 
        'cagliari calcio': 'cagliari', 'empoli fc': 'empoli', 'bologna fc': 'bologna',
        'udinese calcio': 'udinese', 'parma calcio': 'parma', 'venezia fc': 'venezia',
        'como 1907': 'como', 'fiore': 'fiorentina', 'salernitana 1919': 'salernitana', 'atalanta bc': 'atalanta',
        
        'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'om': 'marseille',
        'olympique de marseille': 'marseille', 'ol': 'lyon', 'olympique lyonnais': 'lyon',
        'as monaco': 'monaco', 'stade rennais': 'rennes', 'rc lens': 'lens', 'stade brestois': 'brest',
        'st etienne': 'saint etienne', 'asse': 'saint etienne', 'auxerre': 'aja auxerre',
        
        'sporting': 'sporting cp', 'sporting lisbon': 'sporting cp', 'porto': 'fc porto',
        'benfica': 'sl benfica', 'usa': 'united states', 'korea republic': 'south korea',
        'korea': 'south korea', 'bosnia': 'bosnia and herzegovina', 'dr congo': 'congo dr',
        'cote divoire': 'ivory coast', 'holland': 'netherlands', 'czechia': 'czech republic',
        'turkiye': 'turkey', 'ajax': 'afc ajax', 'psv': 'psv eindhoven', 'celtic fc': 'celtic',
        'rangers fc': 'rangers', 'galatasaray sk': 'galatasaray', 'fenerbahce sk': 'fenerbahce'
    };

    return aliases[name] || name;
};

// 🟢 2. FUZZY MATCHER (Levenshtein algorithm)
const similarity = (s1: string, s2: string) => {
    let longer = s1, shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    if (longer.length === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= longer.length; j++) {
            if (i == 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                costs[j - 1] = lastValue; lastValue = newValue;
            }
        }
        if (i > 0) costs[longer.length] = lastValue;
    }
    return (longer.length - costs[longer.length]) / longer.length;
};

// 🟢 3. THE LIVE SYNC ENGINE
async function runLiveUpdate(request: Request) {
  
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  if (queryKey !== process.env.CRON_KEY && authHeader !== `Bearer ${process.env.CRON_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;
  const syncTasks: Promise<any>[] = []; 

  try {
      const now = Date.now();
      const lookBack = new Date(now - (48 * 60 * 60 * 1000)).toISOString();
      const lookForward = new Date(now + (24 * 60 * 60 * 1000)).toISOString();

      const { data: dbMatches } = await supabase.from('matches').select('*').gt('match_date', lookBack).lt('match_date', lookForward);

      if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: "No matches.", timestamp: now });

      const targetMatches = dbMatches.filter(m => {
          const isActive = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const isFinished = ['FT', 'FINISHED', 'ABD', 'POST'].includes(m.status);
          const missingData = !m.match_events || !m.stats || !m.lineups || (Array.isArray(m.match_events) && m.match_events.length === 0);
          return isActive || (isFinished && missingData);
      });

      if (targetMatches.length === 0) return NextResponse.json({ message: "Up to date.", timestamp: now });

      const activeLeagues = Array.from(new Set(targetMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = targetMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             
             const dbHome = getCanonicalName(dbMatch.home_team);
             const dbAway = getCanonicalName(dbMatch.away_team);
             
             const espnGame = espnMatches.find((e: any) => {
                 // 🔒 1. HARD ID MATCH (100% Guaranteed)
                 if (dbMatch.espn_id && dbMatch.espn_id === e.espn_id) return true;

                 // 🔒 2. TIME CHECK (Relaxed to 36 hours to completely ignore timezone problems)
                 const espnTime = e.startTime;
                 if (Math.abs(dbTime - espnTime) > (36 * 60 * 60 * 1000)) return false;

                 // 🔒 3. ADVANCED SUBSTRING & FUZZY MATCH
                 const espnHome = getCanonicalName(e.home_team);
                 const espnAway = getCanonicalName(e.away_team);
                 
                 // If one name is entirely inside the other (e.g. "nottingham" inside "nottingham forest"), it's an instant 100% match.
                 const homeScore = (dbHome.includes(espnHome) || espnHome.includes(dbHome)) ? 1.0 : similarity(dbHome, espnHome);
                 const awayScore = (dbAway.includes(espnAway) || espnAway.includes(dbAway)) ? 1.0 : similarity(dbAway, espnAway);
                 
                 const combinedScore = (homeScore + awayScore) / 2;
                 
                 // 0.60 threshold
                 if (combinedScore > 0.60) return true;

                 return false;
             });

             if (espnGame) {
                 syncTasks.push((async () => {
                     const richData = await fetchEspnDetails(espnGame.espn_id);
                     
                     let newStatus = dbMatch.status;
                     if (espnGame.status === 'in') newStatus = 'LIVE';
                     else if (espnGame.status === 'post') newStatus = 'FT'; 
                     else if (espnGame.clock === 'HT') newStatus = 'HT';
                     
                     const payload: any = {
                         status: newStatus,
                         home_score: espnGame.home_score,
                         away_score: espnGame.away_score,
                         "displayClock": espnGame.clock,
                         espn_id: espnGame.espn_id, // LEARN THE ID
                         updated_at: new Date().toISOString()
                     };

                     if (richData) {
                         payload.match_events = richData.events;
                         payload.stats = richData.stats;
                         payload.lineups = richData.lineups;
                     }

                     await supabase.from('matches').update(payload).eq('id', dbMatch.id);
                     updates++;
                     logs.push(`✅ Synced: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
                 })());
             } else {
                 logs.push(`⚠️ Missed: ${dbMatch.home_team} vs ${dbMatch.away_team} (Normalized DB: "${dbHome}" vs "${dbAway}")`);
             }
        }
      }
      
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, updates, logs, timestamp: now });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message, timestamp: Date.now() }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }