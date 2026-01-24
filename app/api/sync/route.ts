export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLeagueMatches } from '@/app/lib/matchService';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    const leagues = [
      { id: 'eng.1', name: 'Premier League' },
      { id: 'esp.1', name: 'La Liga' },
      { id: 'ger.1', name: 'Bundesliga' },
      { id: 'ita.1', name: 'Serie A' },
      { id: 'fra.1', name: 'Ligue 1' },
      { id: 'uefa.champions', name: 'Champions League' },
      { id: 'uefa.europa', name: 'Europa League' },
      { id: 'eng.fa.cup', name: 'FA Cup' },
      { id: 'eng.league_cup', name: 'Carabao Cup' },
      { id: 'esp.copa_del_rey', name: 'Copa del Rey' },
      { id: 'ita.coppa_italia', name: 'Coppa Italia' },
      { id: 'ger.dfb_pokal', name: 'DFB Pokal' },
      { id: 'fifa.world', name: 'World Cup' },
      { id: 'uefa.euro', name: 'Euros' }
    ];

    const getFormattedDate = (daysOffset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        return d.toISOString().split('T')[0].replace(/-/g, '');
    };

    const datesToFetch = [getFormattedDate(-1), getFormattedDate(0), getFormattedDate(1)]; 
    const requests = [];

    for (const league of leagues) {
        for (const dateStr of datesToFetch) {
            requests.push(getLeagueMatches(league.id, league.name, dateStr));
        }
    }

    const results = await Promise.all(requests);
    const matchesToSync = results.flat();

    if (matchesToSync.length > 0) {
      const { error } = await supabase.from('matches').upsert(matchesToSync, { onConflict: 'api_id' }); 
      if (error) throw error;
    }

    return NextResponse.json({ success: true, count: matchesToSync.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}