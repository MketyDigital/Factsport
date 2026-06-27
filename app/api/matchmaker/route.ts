export const runtime = 'edge';
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ESPN_LEAGUES, fetchEspnLive } from '@/app/lib/espn';
import { getTeamSearchVariations } from '@/app/lib/teamAliases';

// Helper to check if teams match using our robust variations mapping
const isMatch = (dbName: string, espnName: string) => {
    if (!dbName || !espnName) return false;
    const dbVariations = getTeamSearchVariations(dbName);
    const espnVariations = getTeamSearchVariations(espnName);
    return dbVariations.some(v => espnVariations.includes(v)) || 
           dbVariations.some(v => espnName.toLowerCase().includes(v.toLowerCase())) || 
           espnVariations.some(v => dbName.toLowerCase().includes(v.toLowerCase()));
};

export async function GET(request: Request) { return runMatchmaker(request); }
export async function POST(request: Request) { return runMatchmaker(request); }

async function runMatchmaker(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let logs: string[] = [];
  let mappedCount = 0;
  const syncTasks: Promise<any>[] = [];

  try {
      const now = Date.now();
      const lookBack = new Date(now - (48 * 60 * 60 * 1000)).toISOString(); 
      const todayEnd = new Date(now + (48 * 60 * 60 * 1000)).toISOString(); 

      const { data: dbMatches, error: dbErr } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_date, league')
        .is('espn_id', null)
        .gt('match_date', lookBack)
        .lt('match_date', todayEnd);

      if (dbErr) throw dbErr;
      if (!dbMatches || dbMatches.length === 0) return NextResponse.json({ message: "No unmatched games." });

      const activeLeagues = Array.from(new Set(dbMatches.map(m => m.league)));

      for (const leagueName of activeLeagues) {
        const espnCode = ESPN_LEAGUES[leagueName as string];
        if (!espnCode) continue;

        try {
            const espnMatches = await fetchEspnLive(espnCode);
            if (!espnMatches || espnMatches.length === 0) continue;
            
            const leagueDbMatches = dbMatches.filter(m => m.league === leagueName);

            for (const dbMatch of leagueDbMatches) {
                 const dbTime = new Date(dbMatch.match_date).getTime();
                 
                 const espnGame = espnMatches.find((e: any) => {
                     try {
                         const espnTime = e.startTime || 0;
                         if (espnTime && Math.abs(dbTime - espnTime) > (48 * 60 * 60 * 1000)) return false;

                         return isMatch(dbMatch.home_team, e.home_team) && isMatch(dbMatch.away_team, e.away_team);
                     } catch (err) {
                         return false;
                     }
                 });

                 if (espnGame && espnGame.espn_id) {
                     const updateTask = (async () => {
                        const { error } = await supabase
                            .from('matches')
                            .update({ espn_id: String(espnGame.espn_id) })
                            .eq('id', dbMatch.id);
                        
                        if (error) console.error("Matchmaker Update Error:", error);
                        return true;
                     })();

                     syncTasks.push(updateTask);
                     mappedCount++;
                     logs.push(`🔗 MAPPED: ${dbMatch.home_team} vs ${dbMatch.away_team} -> ESPN ID: ${espnGame.espn_id}`);
                 }
            }
        } catch (leagueErr) {
            console.error(`Error processing league ${leagueName}:`, leagueErr);
        }
      }
      
      await Promise.all(syncTasks);
      return NextResponse.json({ success: true, mappedCount, logs });

  } catch (error: any) {
      console.error("Matchmaker Fatal Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
