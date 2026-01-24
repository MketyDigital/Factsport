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

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );

    // 2. EXPANDED LEAGUE LIST (Includes Cups & Europe)
    const leagues = [
      // Major Leagues
      { id: 'eng.1', name: 'Premier League' },
      { id: 'esp.1', name: 'La Liga' },
      { id: 'ger.1', name: 'Bundesliga' },
      { id: 'ita.1', name: 'Serie A' },
      { id: 'fra.1', name: 'Ligue 1' },
      
      // Major Cups & Continental
      { id: 'uefa.champions', name: 'Champions League' },
      { id: 'uefa.europa', name: 'Europa League' },
      { id: 'eng.fa.cup', name: 'FA Cup' },
      { id: 'eng.league_cup', name: 'Carabao Cup' },
      { id: 'esp.copa_del_rey', name: 'Copa del Rey' },
      { id: 'ita.coppa_italia', name: 'Coppa Italia' },
      { id: 'ger.dfb_pokal', name: 'DFB Pokal' },
      
      // International (Only active during tournaments)
      { id: 'fifa.world', name: 'World Cup' },
      { id: 'uefa.euro', name: 'Euros' }
    ];

    // 3. SMART DATES (Yesterday, Today, Tomorrow)
    // This ensures finished matches stay fresh/visible for 48hrs
    const getFormattedDate = (daysOffset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        return d.toISOString().split('T')[0].replace(/-/g, '');
    };

    const yesterday = getFormattedDate(-1);
    const today = getFormattedDate(0);
    const tomorrow = getFormattedDate(1);

    const datesToFetch = [yesterday, today, tomorrow]; 
    let matchesToSync: any[] = [];

    // 4. FETCH DATA (Parallel Requests)
    const requests = [];

    for (const league of leagues) {
        for (const dateStr of datesToFetch) {
            requests.push(
                fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${dateStr}`, { next: { revalidate: 0 } })
                .then(res => res.json())
                .then(data => ({ ...data, _leagueName: league.name }))
                .catch(err => null)
            );
        }
    }

    const results = await Promise.all(requests);

    results.forEach((data: any) => {
      if (data && data.events) {
        data.events.forEach((event: any) => {
          const competition = event.competitions[0];
          const home = competition.competitors.find((c: any) => c.homeAway === 'home');
          const away = competition.competitors.find((c: any) => c.homeAway === 'away');
          const state = event.status.type.state; 

          let status = 'SCHEDULED';
          if (state === 'in') status = 'LIVE';
          if (state === 'post') status = 'FT';

          // We accept 'pre', 'in', and 'post' to capture all states
          if (['pre', 'in', 'post'].includes(state)) {
              matchesToSync.push({
                api_id: event.id,
                league: data._leagueName,
                home_team: home.team.shortDisplayName || home.team.name,
                away_team: away.team.shortDisplayName || away.team.name,
                home_score: parseInt(home.score) || 0,
                away_score: parseInt(away.score) || 0,
                match_date: event.date,
                status: status,
                home_logo: home.team.logo || home.team.logos?.[0]?.href || null,
                away_logo: away.team.logo || away.team.logos?.[0]?.href || null,
                updated_at: new Date().toISOString()
              });
          }
        });
      }
    });

    // 5. UPSERT TO DATABASE
    if (matchesToSync.length > 0) {
      const { error } = await supabase
        .from('matches')
        .upsert(matchesToSync, { onConflict: 'api_id' }); 
      
      if (error) throw error;
    }

    return NextResponse.json({ 
        success: true, 
        count: matchesToSync.length, 
        leagues_checked: leagues.length,
        dates: datesToFetch 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}