export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

// 🟢 HELPER: Sleep to prevent 429 Errors
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live';
  const batch = searchParams.get('batch') || '1'; 

  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // 1. Define Leagues (Split into Batches to prevent Timeout)
  const allLeagues = [
    // Batch 1: The "Big 4" (Priority)
    { id: 'PL', name: 'Premier League', batch: '1' },
    { id: 'PD', name: 'La Liga', batch: '1' },
    { id: 'BL1', name: 'Bundesliga', batch: '1' },
    { id: 'SA', name: 'Serie A', batch: '1' },
    
    // Batch 2: The Rest
    { id: 'FL1', name: 'Ligue 1', batch: '2' },
    { id: 'CL', name: 'Champions League', batch: '2' },
    { id: 'EC', name: 'European Championship', batch: '2' },
    { id: 'WC', name: 'World Cup', batch: '2' }
  ];

  // Select leagues based on Batch
  const targetLeagues = type === 'full' 
      ? allLeagues.filter(l => l.batch === batch)
      : allLeagues; // Live mode checks all

  // 2. Date Logic (Restoring your -14 to +21 request)
  const today = new Date();
  let fromDate = new Date();
  let toDate = new Date();

  if (type === 'full') {
      // 🟢 RESTORE DB: 2 Weeks Back, 3 Weeks Forward
      fromDate.setDate(today.getDate() - 14);
      toDate.setDate(today.getDate() + 21);
  } else {
      // 🔴 LIVE UPDATE: 3 Days
      fromDate.setDate(today.getDate() - 1);
      toDate.setDate(today.getDate() + 1);
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`🚀 [Sync] Type: ${type} (Batch ${batch}) | Range: ${fromStr} to ${toStr}`);

  try {
      let totalUpserted = 0;

      for (const league of targetLeagues) {
          console.log(`.. Fetching ${league.name} (${league.id})`);
          
          // Fetch data
          const matches = await getLeagueMatches(league.id, league.name, fromStr, toStr);
          
          if (matches.length > 0) {
              const { error } = await supabase.from('matches').upsert(matches, { 
                  onConflict: 'api_id', ignoreDuplicates: false 
              });
              
              if (!error) {
                  totalUpserted += matches.length;
                  console.log(`   ✅ Saved ${matches.length} matches.`);
              } else {
                  console.error(`   ❌ DB Error:`, error.message);
              }
          } else {
               console.log(`   ⚠️ No matches found.`);
          }

          // 🛑 SAFETY DELAY: 5s pause between leagues
          // This prevents the API from blocking us for "Too Many Requests"
          if (targetLeagues.length > 1) await delay(5000); 
      }

      return NextResponse.json({ 
          success: true, 
          batch: batch,
          range: `${fromStr} to ${toStr}`,
          matches_updated: totalUpserted,
          leagues_processed: targetLeagues.length
      });

  } catch (error: any) {
      console.error("🔥 Sync Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}