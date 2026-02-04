export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live'; // Default to 'live'

  // 1. Security Check
  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // 2. Define Leagues to Sync
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

  // 3. Smart Date Logic
  const daysToSync: string[] = []; 
  
  if (type === 'full') {
      // 🟢 FULL MODE: Sync Last 14 Days + Next 30 Days
      // This ensures "Results" has 2 weeks of history and "Fixtures" has 1 month of games.
      for (let i = -14; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        daysToSync.push(date.toISOString().split('T')[0]);
      }
  } else {
      // 🔴 LIVE MODE: Sync Yesterday + Today + Tomorrow
      // Fast sync for live scores.
      for (let i = -1; i <= 1; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        daysToSync.push(date.toISOString().split('T')[0]);
      }
  }

  try {
      // 4. Run Sync in Parallel
      const syncPromises = leagues.map(async (league) => {
          let leagueMatchCount = 0;
          
          const dayPromises = daysToSync.map(async (dateStr) => {
              const matches = await getLeagueMatches(league.id, league.name, dateStr);
              
              if (matches.length > 0) {
                  const { error } = await supabase.from('matches').upsert(matches, { 
                      onConflict: 'api_id',
                      ignoreDuplicates: false 
                  });
                  
                  if (!error) leagueMatchCount += matches.length;
                  else console.error(`Error upserting ${league.name} on ${dateStr}:`, error);
              }
          });

          await Promise.all(dayPromises);
          return leagueMatchCount;
      });

      const results = await Promise.all(syncPromises);
      const totalUpserted = results.reduce((a, b) => a + b, 0);

      return NextResponse.json({ 
          success: true, 
          mode: type,
          days_synced: daysToSync.length,
          total_matches_updated: totalUpserted,
          message: `Synced ${totalUpserted} matches across ${daysToSync.length} days (${type} mode).` 
      });

  } catch (error: any) {
      console.error("Sync Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}