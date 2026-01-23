export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    // 1. Security Check
    const { searchParams } = new URL(req.url);
    if (searchParams.get('key') !== process.env.CRON_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Initialize Admin Client (Bypass RLS)
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
      { id: 'uefa.champions', name: 'Champions League' }
    ];

    // 3. Parallel Fetching (Safe & Fast)
    const requests = leagues.map(league => 
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard`, { next: { revalidate: 0 } })
        .then(res => res.json())
        .then(data => ({ ...data, _leagueName: league.name }))
        .catch(err => {
            console.error(`Failed to fetch ${league.name}:`, err);
            return null;
        })
    );

    const results = await Promise.all(requests);
    let matchesToSync: any[] = [];

    results.forEach((data: any) => {
      if (data && data.events) {
        data.events.forEach((event: any) => {
          const competition = event.competitions[0];
          const home = competition.competitors.find((c: any) => c.homeAway === 'home');
          const away = competition.competitors.find((c: any) => c.homeAway === 'away');
          const state = event.status.type.state; 

          let status = 'SCHEDULED';
          if (state === 'in') status = 'LIVE';
          if (state === 'post') status = 'FT'; // Matches your Settlement Route

          // Slug generation (SEO friendly)
          const slug = `${home.team.name}-vs-${away.team.name}-${event.date.split('T')[0]}`
            .toLowerCase().replace(/[^a-z0-9]+/g, '-');

          matchesToSync.push({
            api_id: event.id, // ✅ CORRECT: Map ESPN ID to api_id
            league: data._leagueName,
            home_team: home.team.shortDisplayName || home.team.name,
            away_team: away.team.shortDisplayName || away.team.name,
            home_score: parseInt(home.score) || 0,
            away_score: parseInt(away.score) || 0,
            match_date: event.date,
            status: status,
            // Only update slug if it's a new match (optional)
            // slug: slug, 
            home_logo: home.team.logo || home.team.logos?.[0]?.href || null,
            away_logo: away.team.logo || away.team.logos?.[0]?.href || null,
            updated_at: new Date().toISOString()
          });
        });
      }
    });

    if (matchesToSync.length > 0) {
      // 4. Upsert using API_ID as the key
      // This updates existing matches instead of crashing on duplicate UUIDs
      const { error } = await supabase
        .from('matches')
        .upsert(matchesToSync, { onConflict: 'api_id' }); 
      
      if (error) {
          console.error("Supabase Upsert Error:", error);
          throw error;
      }
    }

    return NextResponse.json({ success: true, count: matchesToSync.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}