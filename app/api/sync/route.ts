export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live'; 

  // 1. Security Check
  if (key !== process.env.CRON_KEY) {
    console.error("❌ Sync Unauthorized: Wrong Key");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // 2. Define Leagues
  const leagues = [
    { id: 'PL', name: 'Premier League' },
    { id: 'PD', name: 'La Liga' },
    { id: 'BL1', name: 'Bundesliga' },
    { id: 'SA', name: 'Serie A' },
    { id: 'FL1', name: 'Ligue 1' },
    { id: 'CL', name: 'Champions League' },
    { id: 'EC', name: 'European Championship' }, 
    { id: 'WC', name: 'World Cup' }
  ];

  // 3. Smart Date Logic (YOUR ORIGINAL LOGIC RESTORED)
  const today = new Date();
  let fromDate = new Date();
  let toDate = new Date();

  if (type === 'full') {
      // 🟢 FULL MODE: Sync Last 14 Days + Next 30 Days
      fromDate.setDate(today.getDate() - 14);
      toDate.setDate(today.getDate() + 30);
  } else {
      // 🔴 LIVE MODE: Sync Yesterday + Today + Tomorrow
      fromDate.setDate(today.getDate() - 1);
      toDate.setDate(today.getDate() + 1);
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`🚀 [Sync Start] Type: ${type} | Range: ${fromStr} to ${toStr}`);

  try {
      let totalUpserted = 0;
      let leaguesUpdated = 0;

      // 4. Run Sync
      for (const league of leagues) {
          const matches = await getLeagueMatches(league.id, league.name, fromStr, toStr);
          
          if (matches.length > 0) {
              const { error } = await supabase.from('matches').upsert(matches, { 
                  onConflict: 'api_id',
                  ignoreDuplicates: false 
              });
              
              if (!error) {
                  totalUpserted += matches.length;
                  leaguesUpdated++;
                  console.log(`💾 [DB Saved] ${league.name}: Updated ${matches.length} matches.`);
              } else {
                  console.error(`❌ [DB Error] ${league.name}:`, error.message);
              }
          } else {
               console.log(`⚠️ [No Matches] ${league.name}: API returned 0 matches.`);
          }
      }

      return NextResponse.json({ 
          success: true, 
          mode: type,
          range: `${fromStr} to ${toStr}`,
          leagues_updated: leaguesUpdated,
          total_matches_updated: totalUpserted,
          message: `Synced ${totalUpserted} matches across ${leaguesUpdated} leagues.` 
      });

  } catch (error: any) {
      console.error("🔥 Sync Critical Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}