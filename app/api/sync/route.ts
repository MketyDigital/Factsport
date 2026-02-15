export const runtime = 'edge';

import { createClient } from '@/app/lib/supabase/server';
import { getLeagueMatches } from '@/app/lib/matchService';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const type = searchParams.get('type') || 'live'; 

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
    { id: 'CL', name: 'Champions League' },
    { id: 'EC', name: 'Euros' }, 
    { id: 'WC', name: 'World Cup' }
  ];

  const today = new Date();
  let fromDate = new Date();
  let toDate = new Date();

  if (type === 'full') {
      fromDate.setDate(today.getDate() - 14);
      toDate.setDate(today.getDate() + 30);
  } else {
      fromDate.setDate(today.getDate() - 1);
      toDate.setDate(today.getDate() + 1);
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  let debugLogs: string[] = [];
  debugLogs.push(`🚀 Syncing range: ${fromStr} to ${toStr}`);

  try {
      let totalUpserted = 0;

      for (const league of leagues) {
          // Calling the service and capturing the detailed result
          const result = await getLeagueMatches(league.id, league.name, fromStr, toStr);
          
          if (result.error) {
              debugLogs.push(`❌ ${league.name} FAILED: ${result.error}`);
              continue; // Move to next league
          }

          if (result.matches.length > 0) {
              const { error } = await supabase.from('matches').upsert(result.matches, { 
                  onConflict: 'api_id',
                  ignoreDuplicates: false 
              });
              
              if (!error) {
                  totalUpserted += result.matches.length;
                  debugLogs.push(`✅ ${league.name}: Found and saved ${result.matches.length} matches.`);
              } else {
                  debugLogs.push(`⚠️ ${league.name}: Database error: ${error.message}`);
              }
          } else {
              debugLogs.push(`⚠️ ${league.name}: API returned 0 matches.`);
          }
      }

      return NextResponse.json({ 
          success: true, 
          total_upserted: totalUpserted,
          logs: debugLogs 
      });

  } catch (error: any) {
      return NextResponse.json({ error: error.message, logs: debugLogs }, { status: 500 });
  }
}