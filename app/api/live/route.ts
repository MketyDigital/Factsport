export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive, fetchEspnDetails } from '@/app/lib/espn';

// 🟢 1. ROBUST NORMALIZER (Improved Regex)
const normalize = (name: string) => {
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9 ]/g, '') // Remove special chars
        // Remove common words (now handles start-of-string too)
        .replace(/\b(fc|cf|fk|sc|united|city|real|inter|ac|milan|athletic|hotspur|albion|hove|wanderers|town|county|palace)\b/g, '') 
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
};

// 🟢 2. FUZZY MATCHER (Levenshtein)
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

async function runLiveUpdate() {
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
          return NextResponse.json({ message: "No matches found in 48h window." });
      }

      const targetMatches = dbMatches.filter(m => {
          const isActive = ['LIVE', 'HT', 'IN_PLAY', 'SCHEDULED', 'TIMED', 'PRE'].includes(m.status);
          const isFinished = ['FT', 'FINISHED', 'ABD', 'POST'].includes(m.status);
          const missingData = !m.match_events || !m.stats || !m.lineups || (Array.isArray(m.match_events) && m.match_events.length === 0);
          return isActive || (isFinished && missingData);
      });

      if (targetMatches.length === 0) {
          return NextResponse.json({ message: "All matches are up to date." });
      }

      const activeLeagues = Array.from(new Set(targetMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        const espnMatches = await fetchEspnLive(espnCode);
        const leagueDbMatches = targetMatches.filter(m => m.league === leagueName);

        for (const dbMatch of leagueDbMatches) {
             const dbTime = new Date(dbMatch.match_date).getTime();
             const dbName = normalize(dbMatch.home_team);
             
             const espnGame = espnMatches.find((e: any) => {
                 // 🔒 LOCK 1: TIME (4 Hours Tolerance)
                 const espnTime = e.startTime;
                 if (Math.abs(dbTime - espnTime) > (4 * 60 * 60 * 1000)) return false;

                 // 🔒 LOCK 2: SMART NAME MATCH
                 const espnName = normalize(e.home_team);
                 
                 // A. Direct Includes (The "Milan" Fix)
                 if (dbName.includes(espnName) || espnName.includes(dbName)) return true;
                 
                 // B. Starts With (The "Qarabag" Fix)
                 // If "Qarabag" is the first word of "Qarabag Agdam", it matches.
                 if (dbName.startsWith(espnName) || espnName.startsWith(dbName)) return true;
                 
                 // C. Fuzzy Match (The Final Net)
                 const score = similarity(dbName, espnName);
                 if (score > 0.6) return true;

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
                 logs.push(`✅ Synced: ${dbMatch.home_team}`);
             } else {
                 logs.push(`⚠️ Missed: ${dbMatch.home_team} (DB Normalized: "${dbName}")`);
             }
        }
      }
      
      return NextResponse.json({ success: true, updates, logs });

  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) { return runLiveUpdate(); }
export async function POST(request: Request) { return runLiveUpdate(); }