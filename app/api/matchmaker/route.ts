export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive } from '@/app/lib/espn';

// 1. THE EXHAUSTIVE DICTIONARY
const getCanonicalName = (rawName: string) => {
    if (!rawName) return "";
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    const aliases: Record<string, string> = {
        // Premier League & England
        'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
        'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
        'wolverhampton': 'wolverhampton wanderers', 'nottm forest': 'nottingham forest', 'nottingham': 'nottingham forest',
        'sheff utd': 'sheffield united', 'brighton hove albion': 'brighton', 'brighton hove': 'brighton', 
        'west ham united': 'west ham', 'newcastle united': 'newcastle', 'leicester city': 'leicester',
        'sunderland': 'sunderland', 'fulham': 'fulham', 'crystal palace': 'crystal palace', 'liverpool': 'liverpool',
        'afc bournemouth': 'bournemouth', 'luton town': 'luton', 'aston villa fc': 'aston villa', 'arsenal fc': 'arsenal',
        'chelsea fc': 'chelsea', 'everton fc': 'everton', 'brentford fc': 'brentford',
        
        // La Liga & Spain
        'atleti': 'atletico madrid', 'sociedad': 'real sociedad', 'betis': 'real betis',
        'athletic': 'athletic club', 'athletic bilbao': 'athletic club', 'osasuna': 'ca osasuna',
        'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'espanyol barcelona': 'espanyol',
        'getafe cf': 'getafe', 'sevilla fc': 'sevilla', 'barcelona': 'barcelona', 'barca': 'barcelona', 'levante': 'levante',
        'rcd mallorca': 'mallorca', 'cadiz cf': 'cadiz', 'ud almeria': 'almeria', 'ud las palmas': 'las palmas', 'girona fc': 'girona',
        'real madrid cf': 'real madrid', 'valencia cf': 'valencia',
        
        // Bundesliga & Germany
        '1 koln': 'fc cologne', 'koln': 'fc cologne', 'cologne': 'fc cologne',
        'bayern': 'bayern munich', 'bayern munchen': 'bayern munich', 'bvb': 'borussia dortmund',
        'dortmund': 'borussia dortmund', 'gladbach': 'borussia monchengladbach', 'mgladbach': 'borussia monchengladbach',
        'borussia mgladbach': 'borussia monchengladbach', 'leverkusen': 'bayer leverkusen', 'leipzig': 'rb leipzig',
        'frankfurt': 'eintracht frankfurt', 'stuttgart': 'vfb stuttgart', 'mainz': 'mainz 05',
        'hoff': 'tsg hoffenheim', 'hoffenheim': 'tsg hoffenheim', 'union berlin': 'fc union berlin',
        'freiburg': 'sc freiburg', '1 fc heidenheim 1846': 'heidenheim', 'heidenheim 1846': 'heidenheim', 
        'sv darmstadt 98': 'darmstadt', 'darmstadt 98': 'darmstadt', 'vfl bochum 1848': 'bochum', 'fc augsburg': 'augsburg',
        'st pauli': 'sankt pauli', 'fc st pauli': 'sankt pauli',
        
        // Serie A & Italy
        'juve': 'juventus', 'inter': 'inter milan', 'internazionale': 'inter milan',
        'milan': 'ac milan', 'roma': 'as roma', 'lazio': 'ss lazio',
        'napoli': 'ssc napoli', 'hellas verona': 'verona', 'cagliari': 'cagliari calcio',
        'genoa': 'genoa', 'genoa cfc': 'genoa', 'torino': 'torino', 'torino fc': 'torino',
        'lecce': 'us lecce', 'us lecce': 'lecce', 'como 1907': 'como', 'atalanta bc': 'atalanta',
        'ac monza': 'monza', 'us sassuolo': 'sassuolo', 'frosinone calcio': 'frosinone', 'us salernitana 1919': 'salernitana',
        'fiorentina': 'acf fiorentina', 'empoli fc': 'empoli', 'bologna fc': 'bologna', 'udinese calcio': 'udinese',
        
        // Ligue 1 & France
        'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'om': 'marseille',
        'olympique de marseille': 'marseille', 'ol': 'lyon', 'olympique lyonnais': 'lyon',
        'auxerre': 'auxerre', 'stade rennais': 'rennes', 'clermont foot 63': 'clermont', 'clermont foot': 'clermont', 
        'toulouse fc': 'toulouse', 'le havre ac': 'le havre', 'mhsc': 'montpellier', 'montpellier hsc': 'montpellier',
        'st etienne': 'saint etienne', 'asse': 'saint etienne', 'lille osc': 'lille', 'ogc nice': 'nice',
        
        // Internationals / Europe
        'sporting': 'sporting cp', 'sporting lisbon': 'sporting cp', 'porto': 'fc porto',
        'benfica': 'sl benfica', 'usa': 'united states', 'korea republic': 'south korea',
        'korea': 'south korea', 'bosnia': 'bosnia and herzegovina', 'dr congo': 'congo dr',
        'cote divoire': 'ivory coast', 'fc copenhagen': 'copenhagen', 'shakhtar donetsk': 'shakhtar', 
        'galatasaray sk': 'galatasaray', 'fenerbahce sk': 'fenerbahce', 'red bull salzburg': 'fc salzburg', 
        'slavia praha': 'slavia prague', 'ajax': 'afc ajax', 'psv': 'psv eindhoven', 'celtic fc': 'celtic', 'rangers fc': 'rangers'
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

// 3. THE MASTER MATCHMAKER
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient();
  let logs: string[] = [];
  let mappedCount = 0;

  try {
      const now = Date.now();
      const lookBack = new Date(now - (24 * 60 * 60 * 1000)).toISOString(); // 24 hours back
      const todayEnd = new Date(now + (24 * 60 * 60 * 1000)).toISOString(); // 24 hours forward

      // 🔍 Find matches that DO NOT have an ESPN ID yet
      const { data: dbMatches } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_date, league')
        .is('espn_id', null)
        .gt('match_date', lookBack)
        .lt('match_date', todayEnd);

      if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: "No unmatched games." });

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));
      const syncTasks: Promise<any>[] = [];

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             const dbHome = getCanonicalName(dbMatch.home_team);
             const dbAway = getCanonicalName(dbMatch.away_team);
             
             const espnGame = espnMatches.find((e: any) => {
                 const espnTime = e.startTime;
                 if (Math.abs(dbTime - espnTime) > (48 * 60 * 60 * 1000)) return false;

                 const espnHome = getCanonicalName(e.home_team);
                 const espnAway = getCanonicalName(e.away_team);
                 
                 const homeScore = similarity(dbHome, espnHome);
                 const awayScore = similarity(dbAway, espnAway);
                 const combinedScore = (homeScore + awayScore) / 2;
                 
                 return (combinedScore > 0.70 || (homeScore === 1.0 && awayScore > 0.4) || (awayScore === 1.0 && homeScore > 0.4));
             });

             if (espnGame) {
                 // We wrap the update in an async arrow function to guarantee it returns a Promise
                 const updateTask = (async () => {
                    const { error } = await supabase
                        .from('matches')
                        .update({ espn_id: String(espnGame.espn_id) })
                        .eq('id', dbMatch.id);
                    
                    if (error) throw error;
                    return true;
                 })();

                 syncTasks.push(updateTask);
                 
                 mappedCount++;
                 logs.push(`🔗 MAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
             }
        }
      }
      
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, mappedCount, logs });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}