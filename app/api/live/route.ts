export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails } from '@/app/lib/espn';

// 🟢 1. THE MASTER DICTIONARY (Standardizes all crazy names to one format)
const getCanonicalName = (rawName: string) => {
    // A. Strip special characters and truly useless generic prefixes/suffixes ONLY
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9 ]/g, '') // Remove special chars
        .replace(/\b(fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    // B. The Ultimate Alias Database (Covers Top 5 Leagues, Cups & Internationals)
    const aliases: Record<string, string> = {
        // Premier League
        'manchester utd': 'manchester united',
        'man utd': 'manchester united',
        'man city': 'manchester city',
        'spurs': 'tottenham hotspur',
        'tottenham': 'tottenham hotspur',
        'wolves': 'wolverhampton wanderers',
        'wolverhampton': 'wolverhampton wanderers',
        'nottm forest': 'nottingham forest',
        'sheff utd': 'sheffield united',
        // La Liga
        'atleti': 'atletico madrid',
        'sociedad': 'real sociedad',
        'betis': 'real betis',
        'athletic': 'athletic club',
        'athletic bilbao': 'athletic club',
        'osasuna': 'ca osasuna',
        'vallecano': 'rayo vallecano',
        'celta': 'celta vigo',
        // Bundesliga
        '1 koln': 'fc cologne',
        'koln': 'fc cologne',
        'cologne': 'fc cologne',
        'bayern': 'bayern munich',
        'bayern munchen': 'bayern munich',
        'bvb': 'borussia dortmund',
        'dortmund': 'borussia dortmund',
        'gladbach': 'borussia monchengladbach',
        'mgladbach': 'borussia monchengladbach',
        'leverkusen': 'bayer leverkusen',
        'leipzig': 'rb leipzig',
        'frankfurt': 'eintracht frankfurt',
        'stuttgart': 'vfb stuttgart',
        'mainz': 'mainz 05',
        'hoff': 'tsg hoffenheim',
        'hoffenheim': 'tsg hoffenheim',
        'union berlin': 'fc union berlin',
        // Serie A
        'juve': 'juventus',
        'inter': 'inter milan',
        'internazionale': 'inter milan',
        'milan': 'ac milan',
        'roma': 'as roma',
        'lazio': 'ss lazio',
        'napoli': 'ssc napoli',
        'hellas verona': 'verona',
        'lecce': 'us lecce',
        'cagliari': 'cagliari calcio',
        // Ligue 1
        'psg': 'paris saint germain',
        'paris sg': 'paris saint germain',
        'om': 'marseille',
        'olympique de marseille': 'marseille',
        'ol': 'lyon',
        'olympique lyonnais': 'lyon',
        // Internationals / Europe
        'sporting': 'sporting cp',
        'sporting lisbon': 'sporting cp',
        'porto': 'fc porto',
        'benfica': 'sl benfica',
        'usa': 'united states',
        'korea republic': 'south korea',
        'korea': 'south korea',
        'bosnia': 'bosnia and herzegovina',
        'dr congo': 'congo dr',
        'cote divoire': 'ivory coast'
    };

    return aliases[name] || name;
};

// 🟢 2. FUZZY MATCHER (Levenshtein algorithm)
const similarity = (s1: string, s2: string) => {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= longer.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[longer.length] = lastValue;
    }
    return (longerLength - costs[longer.length]) / longerLength;
};

// 🟢 INJECTED: Pass the Request object to read headers and URLs
async function runLiveUpdate(request: Request) {
  
  // 🟢 INJECTED: Security Check (Reads key from URL or Authorization Header)
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  if (queryKey !== process.env.CRON_KEY && authHeader !== `Bearer ${process.env.CRON_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  let logs: string[] = [];
  let updates = 0;

  try {
      const now = Date.now();
      const lookBack = new Date(now - (48 * 60 * 60 * 1000)).toISOString();
      const lookForward = new Date(now + (24 * 60 * 60 * 1000)).toISOString();

      const { data: dbMatches } = await supabase
        .from('matches')
        .select('*')
        .gt('match_date', lookBack) 
        .lt('match_date', lookForward);

      if (!dbMatches || dbMatches.length === 0) {
          // 🟢 INJECTED: timestamp: now
          return NextResponse.json({ message: "No matches found in 48h window.", timestamp: now });
      }

      const targetMatches = dbMatches.filter(m => {
          const isActive = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const isFinished = ['FT', 'FINISHED', 'ABD', 'POST'].includes(m.status);
          const missingData = !m.match_events || !m.stats || !m.lineups || (Array.isArray(m.match_events) && m.match_events.length === 0);
          return isActive || (isFinished && missingData);
      });

      if (targetMatches.length === 0) {
          // 🟢 INJECTED: timestamp: now
          return NextResponse.json({ message: "All matches are up to date.", timestamp: now });
      }

      const activeLeagues = Array.from(new Set(targetMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = targetMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             
             // Normalize the Database Names
             const dbHome = getCanonicalName(dbMatch.home_team);
             const dbAway = getCanonicalName(dbMatch.away_team);
             
             const espnGame = espnMatches.find((e: any) => {
                 // 🔒 LOCK 1: TIME (Matches must be within 4 hours of each other)
                 const espnTime = e.startTime;
                 if (Math.abs(dbTime - espnTime) > (4 * 60 * 60 * 1000)) return false;

                 // Normalize the ESPN Names
                 const espnHome = getCanonicalName(e.home_team);
                 const espnAway = getCanonicalName(e.away_team);
                 
                 // 🔒 LOCK 2: DUAL-TEAM SIMILARITY
                 // We calculate the fuzzy score for BOTH teams. 
                 const homeScore = similarity(dbHome, espnHome);
                 const awayScore = similarity(dbAway, espnAway);
                 
                 // Average the scores. 
                 // If both teams average over 75% similarity, it is mathematically guaranteed to be the right match.
                 const combinedScore = (homeScore + awayScore) / 2;
                 
                 // Special exact match fallback: If either team is a 100% perfect dictionary match, allow it.
                 if (combinedScore > 0.70 || (homeScore === 1.0 && awayScore > 0.4) || (awayScore === 1.0 && homeScore > 0.4)) {
                     return true;
                 }

                 return false;
             });

             if (espnGame) {
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
             } else {
                 logs.push(`⚠️ Missed: ${dbMatch.home_team} vs ${dbMatch.away_team} (Normalized DB: "${dbHome}" vs "${dbAway}")`);
             }
        }
      }
      
      // 🟢 INJECTED: timestamp: now
      return NextResponse.json({ success: true, updates, logs, timestamp: now });

  } catch (error: any) {
      // 🟢 INJECTED: timestamp: Date.now()
      return NextResponse.json({ success: false, error: error.message, timestamp: Date.now() }, { status: 500 });
  }
}

// 🟢 INJECTED: Passed request object down to the function
export async function GET(request: Request) { return runLiveUpdate(request); }
export async function POST(request: Request) { return runLiveUpdate(request); }