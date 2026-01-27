// app/lib/matchService.ts

// ✅ HELPER 1: Extracts Goals & Assists
const formatMatchEvents = (details: any[], homeId: string) => {
  if (!details) return [];
  return details
    .filter((e: any) => e.type?.text?.toLowerCase().includes('goal') && 
                       !e.type?.text?.toLowerCase().includes('missed') && 
                       !e.type?.text?.toLowerCase().includes('saved'))
    .map((e: any) => {
       const isHome = String(e.team?.id) === String(homeId);
       return {
         player: e.participants?.[0]?.athlete?.displayName || e.participants?.[0]?.athlete?.shortName || "Unknown",
         time: e.clock?.displayValue || "0'",
         type: 'goal',
         team: isHome ? 'home' : 'away',
         assist: e.participants?.[1]?.athlete?.displayName || null
       };
    });
};

// ✅ HELPER 2: Extracts Text Commentary (NEW)
const formatCommentary = (playByPlay: any[]) => {
    if (!playByPlay) return [];
    // Take the last 20 events so the list isn't huge
    return playByPlay.slice(0, 30).map((p: any) => ({
        id: p.id,
        time: p.clock?.displayValue || "",
        text: p.text || "No commentary available."
    }));
};

export interface UnifiedMatchData {
    status: string;
    displayClock: string;
    home: { name: string; logo: string; score: number | string; id: string };
    away: { name: string; logo: string; score: number | string; id: string };
    goals: any[];
    commentary: any[]; // 👈 NEW FIELD
    stats: {
        possession: { h: number; a: number };
        shots: { h: number; a: number };
        corners: { h: number; a: number };
        fouls: { h: number; a: number };
    };
    lineups: { home: any[]; away: any[]; };
    hasExternalData: boolean;
}

export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
    const baseData: UnifiedMatchData = {
        status: dbData.status === 'SCHEDULED' ? 'PRE' : (dbData.status === 'FT' ? 'FT' : 'LIVE'),
        displayClock: dbData.status === 'LIVE' ? 'Live' : '',
        home: { name: dbData.home_team, logo: dbData.home_logo, score: dbData.home_score ?? 0, id: 'home' },
        away: { name: dbData.away_team, logo: dbData.away_logo, score: dbData.away_score ?? 0, id: 'away' },
        goals: dbData.match_events || [], 
        commentary: [], // Default empty
        stats: { possession: { h:0, a:0 }, shots: { h:0, a:0 }, corners: { h:0, a:0 }, fouls: { h:0, a:0 } },
        lineups: { home: [], away: [] },
        hasExternalData: false
    };

    try {
        const fetchOptions: any = { next: { revalidate: 45 }, signal: AbortSignal.timeout(5000) };
        let json = null;

        if (dbData.api_id) {
            // ✅ We fetch 'commentary' now via the 'playByPlay' option
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbData.api_id}`, fetchOptions);
            if (res.ok) json = await res.json();
        }

        if (json && json.header) {
            const comp = json.header.competitions?.[0];
            const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
            const box = json.boxscore;
            const homeId = homeComp?.team?.id;

            const getStat = (teamId: string, statName: string) => {
                const team = box?.teams?.find((t: any) => String(t.team?.id) === String(teamId));
                return parseInt(team?.statistics?.find((s: any) => s.name === statName)?.displayValue || '0');
            };

            const getRoster = (teamId: string, idx: number) => {
                const team = json.rosters?.find((r: any) => String(r.team?.id) === String(teamId));
                return team ? team.roster : (json.rosters?.[idx]?.roster || []);
            };

            return {
                status: comp?.status?.type?.state || baseData.status,
                displayClock: comp?.status?.displayClock || '',
                home: { 
                    name: homeComp?.team?.name || baseData.home.name, 
                    logo: homeComp?.team?.logos?.[0]?.href || baseData.home.logo, 
                    score: homeComp?.score ?? baseData.home.score,
                    id: homeComp?.team?.id
                },
                away: { 
                    name: awayComp?.team?.name || baseData.away.name, 
                    logo: awayComp?.team?.logos?.[0]?.href || baseData.away.logo, 
                    score: awayComp?.score ?? baseData.away.score,
                    id: awayComp?.team?.id
                },
                goals: formatMatchEvents(comp?.details, homeId),
                
                // ✅ NEW: Map the commentary
                commentary: formatCommentary(json.commentary || []), 

                stats: {
                    possession: { h: getStat(homeComp?.team?.id, 'possessionPct'), a: getStat(awayComp?.team?.id, 'possessionPct') },
                    shots: { h: getStat(homeComp?.team?.id, 'shotsSummary'), a: getStat(awayComp?.team?.id, 'shotsSummary') },
                    corners: { h: getStat(homeComp?.team?.id, 'corners'), a: getStat(awayComp?.team?.id, 'corners') },
                    fouls: { h: getStat(homeComp?.team?.id, 'foulsCommitted'), a: getStat(awayComp?.team?.id, 'foulsCommitted') },
                },
                lineups: {
                    home: getRoster(homeComp?.team?.id, 0)?.filter((p:any) => p.starter) || [],
                    away: getRoster(awayComp?.team?.id, 1)?.filter((p:any) => p.starter) || []
                },
                hasExternalData: true
            };
        }
    } catch (e) { }
    return baseData;
}

export async function getLeagueMatches(leagueId: string, leagueName: string, dateStr: string) {
    // ... (Keep this function EXACTLY as it was in the previous code, no changes needed here) ...
    // Copy the getLeagueMatches function from the previous response if you need it again, 
    // but the changes above are only for getExternalData which powers the Match Page.
    // I will include a placeholder here to keep the file valid.
    
    const matches: any[] = [];
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${dateStr}`, { next: { revalidate: 0 } });
        if (!res.ok) return [];
        const data = await res.json();
        if (data && data.events) {
            data.events.forEach((event: any) => {
                const competition = event.competitions[0];
                const home = competition.competitors.find((c: any) => c.homeAway === 'home');
                const away = competition.competitors.find((c: any) => c.homeAway === 'away');
                const state = event.status.type.state;
                let status = 'SCHEDULED';
                if (state === 'in') status = 'LIVE';
                if (state === 'post') status = 'FT';
                if (event.status.type.shortDetail === 'HT') status = 'HT';

                if (['pre', 'in', 'post'].includes(state)) {
                     // Reuse the helper to format events for DB
                     const matchEvents = formatMatchEvents(competition.details, home.team.id);
                     matches.push({
                        api_id: event.id, league: leagueName,
                        home_team: home.team.shortDisplayName || home.team.name,
                        away_team: away.team.shortDisplayName || away.team.name,
                        home_score: parseInt(home.score) || 0,
                        away_score: parseInt(away.score) || 0,
                        match_date: event.date, status: status,
                        home_logo: home.team.logo || home.team.logos?.[0]?.href || null,
                        away_logo: away.team.logo || away.team.logos?.[0]?.href || null,
                        updated_at: new Date().toISOString(),
                        match_events: matchEvents
                    });
                }
            });
        }
    } catch (error) { }
    return matches;
}