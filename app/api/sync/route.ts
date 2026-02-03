export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live'; // Default to 'live' if missing

  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const leagues = [
    { id: 'PL', name: 'Premier League' },
    { id: 'PD', name: 'La Liga' },
    { id: 'BL1', name: 'Bundesliga' },
    { id: 'SA', name: 'Serie A' },
    { id: 'FL1', name: 'Ligue 1' },
    { id: 'CL', name: 'Champions League' }
  ];

  // ⚡ SMART DATE LOGIC ⚡
  const daysToSync = [];
  
  if (type === 'full') {
      // FULL MODE: Sync Yesterday + Next 14 Days (Heavy, run rarely)
      for (let i = -1; i <= 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        daysToSync.push(date.toISOString().split('T')[0]);
      }
  } else {
      // LIVE MODE: Sync Yesterday + Today + Tomorrow (Light, run often)
      // We include Yesterday to catch late-night games that just finished
      for (let i = -1; i <= 1; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        daysToSync.push(date.toISOString().split('T')[0]);
      }
  }

  try {
      // Run sync in parallel
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
          message: `Synced ${totalUpserted} matches (${type} mode)` 
      });

  } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}