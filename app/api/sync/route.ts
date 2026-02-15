export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

// 🟢 HELPER: Sleep to isolate Rate Limits from Logic Errors
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live'; 

  // 1. Security Check
  if (key !== process.env.CRON_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Debug: Ensure API Key is loaded
  if (!process.env.FOOTBALL_DATA_KEY) {
     return NextResponse.json({ error: 'Config Error: FOOTBALL_DATA_KEY is missing' }, { status: 500 });
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

  // 3. Date Logic (Your requested -14 to +21)
  const today = new Date();
  let fromDate = new Date();
  let toDate = new Date();

  if (type === 'full') {
      fromDate.setDate(today.getDate() - 14); // 2 Weeks Back
      toDate.setDate(today.getDate() + 21);   // 3 Weeks Forward
  } else {
      fromDate.setDate(today.getDate() - 1);
      toDate.setDate(today.getDate() + 1);
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  // We will collect logs here to show you in the browser
  let logs: string[] = [];
  logs.push(`🚀 [Sync] Type: ${type} | Range: ${fromStr} to ${toStr}`);

  try {
      let totalUpserted = 0;

      for (const league of leagues) {
          const startMsg = `.. Fetching ${league.name} (${league.id})`;
          console.log(startMsg);
          logs.push(startMsg);
          
          try {
              // Fetch data
              const matches = await getLeagueMatches(league.id, league.name, fromStr, toStr);
              
              if (matches.length > 0) {
                  const { error } = await supabase.from('matches').upsert(matches, { 
                      onConflict: 'api_id', ignoreDuplicates: false 
                  });
                  
                  if (!error) {
                      totalUpserted += matches.length;
                      logs.push(`   ✅ Saved ${matches.length} matches.`);
                  } else {
                      logs.push(`   ❌ DB Error: ${error.message}`);
                  }
              } else {
                   logs.push(`   ⚠️ API returned 0 matches (Empty response).`);
              }

          } catch (innerError: any) {
              // Capture the specific API error here
              logs.push(`   🔥 API FAIL: ${innerError.message}`);
          }

          // 🛑 SAFETY DELAY: 6s pause
          // Without this, the error will always be "429 Too Many Requests"
          logs.push(`   ⏳ Waiting 6s to respect API limit...`);
          await delay(6000); 
      }

      return NextResponse.json({ 
          success: true, 
          range: `${fromStr} to ${toStr}`,
          matches_updated: totalUpserted,
          logs: logs // 👈 CHECK THIS IN YOUR BROWSER
      });

  } catch (error: any) {
      return NextResponse.json({ error: error.message, logs: logs }, { status: 500 });
  }
}