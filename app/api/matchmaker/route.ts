export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES } from '@/app/lib/espn';

// 1. THE EXHAUSTIVE DICTIONARY
const getCanonicalName = (rawName: string) => {
    if (!rawName) return "";
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(1|fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|olympique|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    const aliases: Record<string, string> = {
        'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man united': 'manchester united', 'man city': 'manchester city',
        'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
        'wolverhampton': 'wolverhampton wanderers', 'nottm forest': 'nottingham forest', 'nottingham': 'nottingham forest',
        'sheff utd': 'sheffield united', 'brighton hove albion': 'brighton', 'brighton hove': 'brighton', 
        'west ham united': 'west ham', 'newcastle united': 'newcastle', 'leicester city': 'leicester',
        'sunderland': 'sunderland', 'fulham': 'fulham', 'crystal palace': 'crystal palace', 'liverpool': 'liverpool',
        'afc bournemouth': 'bournemouth', 'luton town': 'luton', 'aston villa fc': 'aston villa', 'arsenal fc': 'arsenal',
        'chelsea fc': 'chelsea', 'everton fc': 'everton', 'brentford fc': 'brentford',
        'atleti': 'atletico madrid', 'sociedad': 'real sociedad', 'betis': 'real betis',
        'athletic': 'athletic club', 'athletic bilbao': 'athletic club', 'osasuna': 'ca osasuna',
        'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'espanyol barcelona': 'espanyol',
        'getafe cf': 'getafe', 'sevilla fc': 'sevilla', 'barcelona': 'barcelona', 'barca': 'barcelona', 'levante': 'levante',
        'rcd mallorca': 'mallorca', 'cadiz cf': 'cadiz', 'ud almeria': 'almeria', 'ud las palmas': 'las palmas', 'girona fc': 'girona',
        'real madrid cf': 'real madrid', 'valencia cf': 'valencia',
        '1 koln': 'fc cologne', 'koln': 'fc cologne', 'cologne': 'fc cologne',
        'bayern': 'bayern munich', 'bayern munchen': 'bayern munich', 'bvb': 'borussia dortmund',
        'dortmund': 'borussia dortmund', 'gladbach': 'borussia monchengladbach', 'mgladbach': 'borussia monchengladbach',
        'borussia mgladbach': 'borussia monchengladbach', 'leverkusen': 'bayer leverkusen', 'leipzig': 'rb leipzig',
        'frankfurt': 'eintracht frankfurt', 'stuttgart': 'vfb stuttgart', 'mainz': 'mainz 05',
        'hoff': 'tsg hoffenheim', 'hoffenheim': 'tsg hoffenheim', 'union berlin': 'fc union berlin',
        'freiburg': 'sc freiburg', '1 fc heidenheim 1846': 'heidenheim', 'heidenheim 1846': 'heidenheim', 
        'sv darmstadt 98': 'darmstadt', 'darmstadt 98': 'darmstadt', 'vfl bochum 1848': 'bochum', 'fc augsburg': 'augsburg',
        'st pauli': 'sankt pauli', 'fc st pauli': 'sankt pauli',
        'juve': 'juventus', 'inter': 'inter milan', 'internazionale': 'inter milan',
        'milan': 'ac milan', 'roma': 'as roma', 'lazio': 'ss lazio',
        'napoli': 'ssc napoli', 'hellas verona': 'verona', 'cagliari': 'cagliari',
        'genoa': 'genoa', 'genoa cfc': 'genoa', 'torino': 'torino', 'torino fc': 'torino',
        'lecce': 'lecce', 'us lecce': 'lecce', 'como 1907': 'como', 'atalanta bc': 'atalanta',
        'ac monza': 'monza', 'us sassuolo': 'sassuolo', 'frosinone calcio': 'frosinone', 'us salernitana 1919': 'salernitana',
        'fiorentina': 'acf fiorentina', 'empoli fc': 'empoli', 'bologna fc': 'bologna', 'udinese calcio': 'udinese',
        'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'om': 'marseille',
        'olympique de marseille': 'marseille', 'ol': 'lyon', 'olympique lyonnais': 'lyon', 'olympique lyon': 'lyon', 
        'paris fc': 'paris fc', 
        'auxerre': 'auxerre', 'stade rennais': 'rennes', 'clermont foot 63': 'clermont', 'clermont foot': 'clermont', 
        'toulouse fc': 'toulouse', 'le havre ac': 'le havre', 'mhsc': 'montpellier', 'montpellier hsc': 'montpellier',
        'st etienne': 'saint etienne', 'asse': 'saint etienne', 'lille osc': 'lille', 'ogc nice': 'nice',
        'sporting': 'sporting cp', 'sporting lisbon': 'sporting cp', 'porto': 'fc porto',
        'benfica': 'sl benfica', 'fc copenhagen': 'copenhagen', 'shakhtar donetsk': 'shakhtar', 
        'galatasaray sk': 'galatasaray', 'fenerbahce sk': 'fenerbahce', 'red bull salzburg': 'fc salzburg', 
        'slavia praha': 'slavia prague', 'ajax': 'afc ajax', 'psv': 'psv eindhoven', 'celtic fc': 'celtic', 'rangers fc': 'rangers',
        'usa': 'united states', 'usmnt': 'united states', 'uswnt': 'united states',
        'korea republic': 'south korea', 'korea': 'south korea',
        'bosnia': 'bosnia and herzegovina', 'dr congo': 'congo dr',
        'cote divoire': 'ivory coast', "cote d'ivoire": 'ivory coast', "côte d'ivoire": 'ivory coast',
        'brasil': 'brazil', 'españa': 'spain', 'espana': 'spain',
        'italia': 'italy', 'deutschland': 'germany', 'holland': 'netherlands',
        'hrvatska': 'croatia', 'turkiye': 'turkey', 'türkiye': 'turkey',
        'czechia': 'czech republic', 'republic of ireland': 'ireland', 'canmnt': 'canada'
    };
    return aliases[name] || name;
};

// 2. FUZZY MATCHER
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

const isStrongMatch = (s1: string, s2: string, score: number) => {
    if ((s1.includes(s2) && s2.length >= 5) || (s2.includes(s1) && s1.length >= 5)) return true;
    if (score > 0.8) return true;
    
    // Explicit exclusions to prevent derby/city mixups
    const bothContain = (word: string) => s1.includes(word) && s2.includes(word);
    if (bothContain("manchester") && score < 0.8) return false;
    if (bothContain("madrid") && score < 0.8) return false;
    if (bothContain("milan") && score < 0.8) return false;
    if (bothContain("london") && score < 0.8) return false;
    
    const tokens1 = s1.split(' ').filter(w => w.length >= 4); 
    const tokens2 = s2.split(' ').filter(w => w.length >= 4);
    if (tokens1.length > 0 && tokens2.length > 0) {
        let matchCount = 0;
        for (const t1 of tokens1) {
            if (tokens2.includes(t1)) matchCount++;
        }
        if (matchCount === Math.max(tokens1.length, tokens2.length)) return true;
    }
    return false;
};

// HELPER: DATE FORMATTER FOR ESPN API
const formatEspnDate = (date: Date) => {
    return date.toISOString().split('T')[0].replace(/-/g, '');
};

// HELPER: FETCH ESPN DATA
async function fetchEspnLive(espnCode: string, daysPast: number, daysFuture: number) {
    const now = new Date();
    // Fetch a wider window: -2 to +5 days
    const startDate = new Date(now.getTime() - (daysPast * 24 * 60 * 60 * 1000));
    const endDate = new Date(now.getTime() + (daysFuture * 24 * 60 * 60 * 1000));
    const dateRange = `${formatEspnDate(startDate)}-${formatEspnDate(endDate)}`;
    
    // Increased limit to 300 to capture heavy windows without cutoff
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${dateRange}&limit=300`;
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" }
    });
    if (!response.ok) throw new Error(`ESPN API returned ${response.status}`);
    const data = await response.json();
    return data.events || [];
}

// 3. THE MASTER MATCHMAKER
async function runMatchmaker(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: "[CONFIG_ERROR] Missing Supabase Keys." }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let logs: string[] = [];
  let mappedCount = 0;
  let remappedCount = 0;
  const syncTasks: (() => Promise<boolean>)[] = [];
  const newlyAssignedEspnIds = new Set<string>();

  try {
      const now = Date.now();
      // Expanded mapping window: -2 days to +5 days to cover wide range of matches
      const lookBack = new Date(now - (2 * 24 * 60 * 60 * 1000)).toISOString(); 
      const lookForward = new Date(now + (5 * 24 * 60 * 60 * 1000)).toISOString(); 

      // Select ALL matches in the window so we can catch ESPN ID changes before the match starts
      const { data: dbMatches, error: dbError } = await supabase.from('matches')
          .select('id, home_team, away_team, match_date, league, espn_id')
          .gt('match_date', lookBack)
          .lt('match_date', lookForward);

      if (dbError) throw new Error(`[SUPABASE_SELECT_ERROR] ${dbError.message}`);
      if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: "No matches in window." });

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        let espnMatches: any[] = [];
        try {
            // Fetch using our -2 to +5 day window constraint
            espnMatches = await fetchEspnLive(espnCode, 2, 5);
        } catch (apiErr: any) {
            logs.push(`❌ ESPN API ERROR ${leagueName}: ${apiErr.message}`);
            continue;
        }

        const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);
        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             const dbHome = getCanonicalName(dbMatch.home_team);
             const dbAway = getCanonicalName(dbMatch.away_team);
             
             let bestMatch = null;
             let bestScore = 0;

             for (const e of espnMatches) {
                 if (!e) continue;
                 const currentEspnId = String(e.id || e.espn_id); 
                 if (!currentEspnId || currentEspnId === 'undefined') continue;
                 
                 // Skip if we already used this ESPN game for a DIFFERENT DB match in this exact run
                 if (newlyAssignedEspnIds.has(currentEspnId) && dbMatch.espn_id !== currentEspnId) continue;

                 const espnTimeString = e.date || e.startTime;
                 const espnTime = espnTimeString ? new Date(espnTimeString).getTime() : 0;
                 
                 // Relaxed time constraint to 48 hours to account for API timezone/date drifts
                 if (espnTime && !isNaN(espnTime) && Math.abs(dbTime - espnTime) > (48 * 60 * 60 * 1000)) continue;

                 const rawEspnHome = e.home_team || e.homeTeam || "";
                 const rawEspnAway = e.away_team || e.awayTeam || "";
                 
                 let espnHomeName = rawEspnHome;
                 let espnAwayName = rawEspnAway;
                 if (!espnHomeName && e.competitions && e.competitions[0] && e.competitions[0].competitors) {
                     const competitors = e.competitions[0].competitors;
                     const homeComp = competitors.find((c: any) => c.homeAway === 'home');
                     const awayComp = competitors.find((c: any) => c.homeAway === 'away');
                     if (homeComp) espnHomeName = homeComp.team.name || homeComp.team.displayName;
                     if (awayComp) espnAwayName = awayComp.team.name || awayComp.team.displayName;
                 }

                 const espnHome = getCanonicalName(espnHomeName);
                 const espnAway = getCanonicalName(espnAwayName);
                 
                 const homeSim = similarity(dbHome, espnHome);
                 const awaySim = similarity(dbAway, espnAway);
                 
                 const isHomeMatch = isStrongMatch(dbHome, espnHome, homeSim);
                 const isAwayMatch = isStrongMatch(dbAway, espnAway, awaySim);

                 if (isHomeMatch && isAwayMatch) {
                     const totalScore = homeSim + awaySim;
                     if (totalScore > bestScore) {
                         bestScore = totalScore;
                         bestMatch = e;
                     }
                 }
             }

             if (bestMatch) {
                 const targetEspnId = String(bestMatch.id || bestMatch.espn_id);
                 
                 // If the ID hasn't changed, just mark it used and move on
                 if (dbMatch.espn_id === targetEspnId) {
                     newlyAssignedEspnIds.add(targetEspnId);
                     continue;
                 }

                 // ID has changed (or was null), prep for batch execution
                 newlyAssignedEspnIds.add(targetEspnId);
                 syncTasks.push(async () => {
                     const { error } = await supabase.from('matches').update({ espn_id: targetEspnId }).eq('id', dbMatch.id);
                     if (error) {
                         logs.push(`❌ UPDATE CRASH: ${error.message}`);
                         return false;
                     }
                     return true;
                 });

                 if (dbMatch.espn_id) {
                     remappedCount++;
                     logs.push(`🔄 REMAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team} (${dbMatch.espn_id} -> ${targetEspnId})`);
                 } else {
                     mappedCount++;
                     logs.push(`🔗 MAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team} -> ${targetEspnId}`);
                 }
             }
        }
      }
      
      // Batch execute promises (15 at a time) to prevent Cloudflare/Supabase connection saturation
      const batchSize = 15;
      for (let i = 0; i < syncTasks.length; i += batchSize) {
          const batch = syncTasks.slice(i, i + batchSize).map(task => task());
          await Promise.all(batch);
      }

      return NextResponse.json({ success: true, mappedCount, remappedCount, logs });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: `[RUNTIME_ERROR] ${error.message}` }, { status: 500 });
  }
}

export async function GET(request: Request) { return runMatchmaker(request); }
export async function POST(request: Request) { return runMatchmaker(request); }