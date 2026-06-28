export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive } from '@/app/lib/espn';

// 1. THE EXHAUSTIVE DICTIONARY (Upgraded)
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
        'napoli': 'ssc napoli', 'hellas verona': 'verona', 'cagliari': 'cagliari calcio',
        'genoa': 'genoa', 'genoa cfc': 'genoa', 'torino': 'torino', 'torino fc': 'torino',
        'lecce': 'us lecce', 'us lecce': 'lecce', 'como 1907': 'como', 'atalanta bc': 'atalanta',
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
        
        // NATIONS / INTERNATIONAL ALIASES
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

// 🔥 2.5 THE NEW SUBSTRING SAFETY NET
const isStrongSubstring = (s1: string, s2: string) => {
    if (s1.length < 4 || s2.length < 4) return false; 
    return s1.includes(s2) || s2.includes(s1);
};

// 🔥 2.6 THE NEW TOKEN MATCHER (Catches "Man United" vs "Manchester United")
const isTokenMatch = (s1: string, s2: string) => {
    const tokens1 = s1.split(' ').filter(w => w.length > 4); // Only care about substantial words
    const tokens2 = s2.split(' ').filter(w => w.length > 4);
    return tokens1.some(t1 => tokens2.includes(t1));
};

// 3. THE MASTER MATCHMAKER
async function runMatchmaker(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check critical environment configurations before proceeding
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: "[CONFIG_ERROR] Missing Supabase Environment Variables keys." }, { status: 500 });
  }

  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let logs: string[] = [];
  let mappedCount = 0;
  const syncTasks: Promise<any>[] = [];

  try {
      const now = Date.now();
      const lookBack = new Date(now - (48 * 60 * 60 * 1000)).toISOString(); 
      const todayEnd = new Date(now + (48 * 60 * 60 * 1000)).toISOString(); 

      // --- ISOLATED STEP 1: SUPABASE MATCH SELECTION ---
      const { data: dbMatches, error: dbError } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_date, league')
        .is('espn_id', null)
        .gt('match_date', lookBack)
        .lt('match_date', todayEnd);

      if (dbError) {
          throw new Error(`[SUPABASE_SELECT_ERROR] Code ${dbError.code}: ${dbError.message}`);
      }

      if (!dbMatches || dbMatches.length === 0) {
          return NextResponse.json({ message: "No unmatched games." });
      }

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        // --- ISOLATED STEP 2: THIRD PARTY API FETCH ---
        let espnMatches: any[] = [];
        try {
            const fetchedData = await fetchEspnLive(espnCode);
            if (!fetchedData || !Array.isArray(fetchedData)) {
                throw new Error("ESPN fetch did not resolve to a valid Array.");
            }
            espnMatches = fetchedData;
        } catch (apiErr: any) {
            throw new Error(`[ESPN_API_ERROR] League ${leagueName} failed: ${apiErr.message}`);
        }

        const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             const dbHome = getCanonicalName(dbMatch.home_team);
             const dbAway = getCanonicalName(dbMatch.away_team);
             
             const espnGame = espnMatches.find((e: any) => {
                 if (!e) return false;
                 const espnTimeString = e.date || e.startTime;
                 const espnTime = espnTimeString ? new Date(espnTimeString).getTime() : 0;
                 
                 if (espnTime && Math.abs(dbTime - espnTime) > (48 * 60 * 60 * 1000)) return false;

                 const espnHome = getCanonicalName(e.home_team);
                 const espnAway = getCanonicalName(e.away_team);
                 
                 const homeScore = similarity(dbHome, espnHome);
                 const awayScore = similarity(dbAway, espnAway);
                 
                 const homeMatch = isStrongSubstring(dbHome, espnHome) || isTokenMatch(dbHome, espnHome) || homeScore > 0.75;
                 const awayMatch = isStrongSubstring(dbAway, espnAway) || isTokenMatch(dbAway, espnAway) || awayScore > 0.75;

                 return homeMatch && awayMatch;
             });

             if (espnGame) {
                 // --- ISOLATED STEP 3: DATABASE MUTATION TASKS ---
                 const updateTask = (async () => {
                    const { error } = await supabase
                        .from('matches')
                        .update({ espn_id: String(espnGame.espn_id) })
                        .eq('id', dbMatch.id);
                    
                    if (error) {
                        throw new Error(`[SUPABASE_UPDATE_ERROR] ID ${dbMatch.id}: ${error.message}`);
                    }
                    return true;
                 })().catch(e => {
                     // Catch failures on individual updates silently so it doesn't crash the entire list sync
                     logs.push(`❌ UPDATE ROW CRASH: ${e.message}`);
                     return false;
                 });

                 syncTasks.push(updateTask);
                 mappedCount++;
                 logs.push(`🔗 MAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
             }
        }
      }
      
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, mappedCount, logs });

  } catch (error: any) {
      const msg = error.message || "Unknown unexpected system error.";
      // Format response prefix to make debugging on GitHub actions obvious
      if (msg.startsWith("[SUPABASE_") || msg.startsWith("[ESPN_API_")) {
          return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: `[RUNTIME_ERROR] ${msg}` }, { status: 500 });
  }
}

export async function GET(request: Request) { return runMatchmaker(request); }
export async function POST(request: Request) { return runMatchmaker(request); }