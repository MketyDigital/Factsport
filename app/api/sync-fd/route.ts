export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== process.env.CRON_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const API_KEY = process.env.FOOTBALL_DATA_KEY;
  if (!API_KEY) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

  const LEAGUES = [ { id: 'PL' }, { id: 'PD' }, { id: 'BL1' }, { id: 'SA' }, { id: 'FL1' }, { id: 'CL' }, { id: 'EC' }, { id: 'WC' } ];

  try {
    const today = new Date();
    const fromDate = new Date(today); fromDate.setDate(today.getDate() - 2);
    const toDate = new Date(today); 
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    let totalUpdated = 0; let logs: string[] = [];

    for (const league of LEAGUES) {
        const res = await fetch(`https://api.football-data.org/v4/competitions/${league.id}/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { headers: { 'X-Auth-Token': API_KEY } });
        if (!res.ok) continue;
        
        const data = await res.json();
        for (const m of data.matches || []) {
            if (!['IN_PLAY', 'PAUSED', 'FINISHED', 'AWARDED'].includes(m.status)) continue; 
            
            const { data: dbMatch } = await supabase.from('matches').select('id, status, updated_at, home_score, away_score, espn_id').eq('api_id', m.id).single();
            if (!dbMatch) continue;

            const isFdFinished = ['FINISHED', 'AWARDED'].includes(m.status);
            const fdStatusMapped = isFdFinished ? 'FT' : (m.status === 'PAUSED' ? 'HT' : 'LIVE');
            const fdHomeScore = m.score.fullTime.home ?? 0;
            const fdAwayScore = m.score.fullTime.away ?? 0;
            let shouldUpdate = false;

            // SCENARIO A: Match is officially over. Enforce score, even if ESPN got it wrong.
            if (isFdFinished) {
                if (dbMatch.status !== 'FT' || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                    shouldUpdate = true;
                }
            } 
            // SCENARIO B: Stubborn Team Fallback (If ESPN missed kickoff or froze)
            else {
                const minutesSinceLastUpdate = (Date.now() - new Date(dbMatch.updated_at).getTime()) / 60000;
                if (dbMatch.status === 'SCHEDULED' || minutesSinceLastUpdate > 10 || !dbMatch.espn_id) {
                    if (dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore || dbMatch.status !== fdStatusMapped) {
                        shouldUpdate = true;
                    }
                }
            }

            if (shouldUpdate) {
                await supabase.from('matches').update({ home_score: fdHomeScore, away_score: fdAwayScore, status: fdStatusMapped, updated_at: new Date().toISOString() }).eq('api_id', m.id);
                totalUpdated++; logs.push(`FD Overwrite: ${m.id} -> ${fdStatusMapped} ${fdHomeScore}-${fdAwayScore}`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return NextResponse.json({ success: true, updated: totalUpdated, logs });

  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}