// app/api/matchmaker/route.ts
// @ts-nocheck
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive } from '@/app/lib/espn';

const getCanonicalName = (rawName: string) => {
  if (!rawName) return '';
  let name = rawName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases: Record<string, string> = {
    'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man united': 'manchester united',
    'man city': 'manchester city', 'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur',
    'wolves': 'wolverhampton wanderers', 'wolverhampton': 'wolverhampton wanderers',
    'nottm forest': 'nottingham forest', 'nottingham': 'nottingham forest',
    'sheff utd': 'sheffield united', 'brighton hove albion': 'brighton', 'brighton hove': 'brighton',
    'west ham united': 'west ham', 'newcastle united': 'newcastle', 'leicester city': 'leicester',
    'aston villa fc': 'aston villa', 'arsenal fc': 'arsenal', 'chelsea fc': 'chelsea', 'everton fc': 'everton',
    'brentford fc': 'brentford', 'afc bournemouth': 'bournemouth', 'atleti': 'atletico madrid',
    'sociedad': 'real sociedad', 'betis': 'real betis', 'athletic': 'athletic club', 'athletic bilbao': 'athletic club',
    'osasuna': 'ca osasuna', 'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'espanyol barcelona': 'espanyol',
    'getafe cf': 'getafe', 'sevilla fc': 'sevilla', 'barcelona': 'barcelona', 'barca': 'barcelona',
    'real madrid cf': 'real madrid', 'valencia cf': 'valencia', 'koln': 'fc cologne', 'cologne': 'fc cologne',
    'bayern': 'bayern munich', 'bayern munchen': 'bayern munich', 'bvb': 'borussia dortmund', 'dortmund': 'borussia dortmund',
    'gladbach': 'borussia monchengladbach', 'mgladbach': 'borussia monchengladbach', 'leverkusen': 'bayer leverkusen',
    'leipzig': 'rb leipzig', 'frankfurt': 'eintracht frankfurt', 'stuttgart': 'vfb stuttgart', 'mainz': 'mainz 05',
    'hoffenheim': 'tsg hoffenheim', 'union berlin': 'fc union berlin', 'freiburg': 'sc freiburg', 'heidenheim': 'heidenheim',
    'darmstadt': 'darmstadt', 'bochum': 'bochum', 'augsburg': 'augsburg', 'sankt pauli': 'sankt pauli',
    'juve': 'juventus', 'inter': 'inter milan', 'internazionale': 'inter milan', 'milan': 'ac milan',
    'roma': 'as roma', 'lazio': 'ss lazio', 'napoli': 'ssc napoli', 'verona': 'hellas verona', 'cagliari': 'cagliari calcio',
    'genoa': 'genoa', 'torino': 'torino', 'lecce': 'us lecce', 'como': 'como', 'atalanta': 'atalanta', 'monza': 'ac monza',
    'sassuolo': 'us sassuolo', 'fiorentina': 'acf fiorentina', 'empoli': 'empoli', 'bologna': 'bologna fc', 'udinese': 'udinese calcio',
    'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'om': 'marseille', 'olympique de marseille': 'marseille',
    'ol': 'lyon', 'olympique lyonnais': 'lyon', 'paris fc': 'paris fc', 'auxerre': 'auxerre', 'stade rennais': 'rennes',
    'clermont foot': 'clermont', 'toulouse': 'toulouse fc', 'le havre': 'le havre', 'mhsc': 'montpellier', 'montpellier hsc': 'montpellier',
    'st etienne': 'saint etienne', 'asse': 'saint etienne', 'lille osc': 'lille', 'ogc nice': 'nice',
    'sporting': 'sporting cp', 'sporting lisbon': 'sporting cp', 'porto': 'fc porto', 'benfica': 'sl benfica',
    'usa': 'united states', 'usmnt': 'united states', 'uswnt': 'united states', 'united states': 'united states',
    'argentina': 'argentina', 'brazil': 'brazil', 'brasil': 'brazil', 'france': 'france', 'england': 'england', 
    'spain': 'spain', 'italy': 'italy', 'germany': 'germany', 'deutschland': 'germany', 'portugal': 'portugal', 
    'netherlands': 'netherlands', 'holland': 'netherlands', 'belgium': 'belgium', 'croatia': 'croatia', 'uruguay': 'uruguay', 
    'colombia': 'colombia', 'mexico': 'mexico', 'senegal': 'senegal', 'morocco': 'morocco', 'japan': 'japan', 
    'south korea': 'south korea', 'korea republic': 'south korea', 'korea': 'south korea', 'switzerland': 'switzerland', 
    'denmark': 'denmark', 'sweden': 'sweden', 'poland': 'poland', 'wales': 'wales', 'scotland': 'scotland', 
    'ireland': 'ireland', 'republic of ireland': 'ireland', 'norway': 'norway', 'austria': 'austria', 'hungary': 'hungary', 
    'serbia': 'serbia', 'turkey': 'turkey', 'ukraine': 'ukraine', 'czech republic': 'czechia', 'czechia': 'czechia', 
    'greece': 'greece', 'romania': 'romania', 'chile': 'chile', 'peru': 'peru', 'ecuador': 'ecuador', 'paraguay': 'paraguay', 
    'venezuela': 'venezuela', 'bolivia': 'bolivia', 'canada': 'canada', 'costa rica': 'costa rica', 'panama': 'panama', 
    'jamaica': 'jamaica', 'nigeria': 'nigeria', 'egypt': 'egypt', 'cameroon': 'cameroon', 'ghana': 'ghana', 
    'ivory coast': 'ivory coast', 'cote divoire': 'ivory coast', "côte d'ivoire": 'ivory coast', 'algeria': 'algeria', 
    'tunisia': 'tunisia', 'mali': 'mali', 'iran': 'iran', 'australia': 'australia', 'saudi arabia': 'saudi arabia', 
    'qatar': 'qatar', 'uzbekistan': 'uzbekistan', 'new zealand': 'new zealand', 'south africa': 'south africa', 
    'dr congo': 'congo dr', 'democratic republic of the congo': 'congo dr', 'bosnia': 'bosnia and herzegovina', 
    'bosnia and herzegovina': 'bosnia and herzegovina', 'slovakia': 'slovakia', 'slovenia': 'slovenia', 
    'albania': 'albania', 'georgia': 'georgia', 'cape verde': 'cape verde', 'cabo verde': 'cape verde'
  };

  return aliases[name] || name;
};

const similarity = (s1: string, s2: string) => {
  let longer = s1, shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  if (longer.length === 0) return 1.0;
  const costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return (longer.length - costs[longer.length]) / longer.length;
};

const isStrongSubstring = (s1: string, s2: string) => {
  if (s1.length < 4 || s2.length < 4) return false;
  return s1.includes(s2) || s2.includes(s1);
};

const isTokenMatch = (s1: string, s2: string) => {
  const tokens1 = s1.split(' ').filter((w) => w.length > 4);
  const tokens2 = s2.split(' ').filter((w) => w.length > 4);
  return tokens1.some((t1) => tokens2.includes(t1));
};

async function runMatchmaker(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const logs: string[] = [];
  let mappedCount = 0;

  try {
    const now = Date.now();
    const lookBack = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const todayEnd = new Date(now + 72 * 60 * 60 * 1000).toISOString();

    const { data: dbMatches, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, match_date, league, api_id')
      .is('espn_id', null)
      .gt('match_date', lookBack)
      .lt('match_date', todayEnd);

    if (error) throw error;
    if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: 'No unmatched games.' });

    const activeLeagues = Array.from(new Set(dbMatches.map((m) => m.league)));

    for (const leagueName of activeLeagues) {
      const espnCode = ESPN_LEAGUES[leagueName];
      if (!espnCode) continue;

      const espnMatches = await fetchEspnLive(espnCode);
      const leagueDbMatches = dbMatches.filter((m) => m.league === leagueName);

      for (const dbMatch of leagueDbMatches) {
        const dbTime = new Date(dbMatch.match_date).getTime();
        const dbHome = getCanonicalName(dbMatch.home_team);
        const dbAway = getCanonicalName(dbMatch.away_team);

        const espnGame = espnMatches.find((e: any) => {
          const espnTimeString = e.date || e.startTime;
          const espnTime = espnTimeString ? new Date(espnTimeString).getTime() : 0;
          if (espnTime && Math.abs(dbTime - espnTime) > 72 * 60 * 60 * 1000) return false;

          const espnHome = getCanonicalName(e.home_team);
          const espnAway = getCanonicalName(e.away_team);
          const homeScore = similarity(dbHome, espnHome);
          const awayScore = similarity(dbAway, espnAway);
          const homeMatch = isStrongSubstring(dbHome, espnHome) || isTokenMatch(dbHome, espnHome) || homeScore > 0.75;
          const awayMatch = isStrongSubstring(dbAway, espnAway) || isTokenMatch(dbAway, espnAway) || awayScore > 0.75;
          return homeMatch && awayMatch;
        });

        if (espnGame) {
          await supabase.from('matches').update({
            // Important fix: DO NOT update api_id! Keep football data's api_id to prevent duplicates on the next sync
            espn_id: String(espnGame.espn_id)
          }).eq('id', dbMatch.id);
          mappedCount++;
          logs.push(`🔗 MAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team}`);
        }
      }
    }
    return NextResponse.json({ success: true, mappedCount, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runMatchmaker(request); }
export async function POST(request: Request) { return runMatchmaker(request); }
