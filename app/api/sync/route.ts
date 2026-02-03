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

    // List of leagues to sync. The ID param is ignored by the new adapter, only name matters.
    const leagues = [
      { id: 'ignored', name: 'Premier League' },
      { id: 'ignored', name: 'La Liga' },
      { id: 'ignored', name: 'Bundesliga' },
      { id: 'ignored', name: 'Serie A' },
      { id: 'ignored', name: 'Ligue 1' },
      { id: 'ignored', name: 'Champions League' },
    ];

    // Fetch yesterday, today, tomorrow to be safe
    const dates = [0].map(offset => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
    });

    let allMatches: any[] = [];

    // Loop through dates and leagues
    for (const date of dates) {
        const requests = leagues.map(l => getLeagueMatches(l.id, l.name, date));
        const results = await Promise.all(requests);
        allMatches = [...allMatches, ...results.flat()];
    }

    if (allMatches.length > 0) {
      // Upsert using the new API_ID column
      const { error } = await supabase.from('matches').upsert(allMatches, { 
          onConflict: 'api_id',
          ignoreDuplicates: false 
      }); 
      if (error) throw error;
    }

    return NextResponse.json({ success: true, synced: allMatches.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}