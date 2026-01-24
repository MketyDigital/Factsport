// app/lib/matchService.ts

// --- 1. THE DATA CONTRACT (Do not change this) ---
export interface UnifiedMatchData {
    status: 'PRE' | 'LIVE' | 'FT';
    displayClock: string;
    home: { name: string; logo: string; score: number | string; id: string };
    away: { name: string; logo: string; score: number | string; id: string };
    goals: any[];
    stats: {
        possession: { h: number; a: number };
        shots: { h: number; a: number };
        corners: { h: number; a: number };
        fouls: { h: number; a: number };
    };
    lineups: { home: any[]; away: any[]; };
    hasExternalData: boolean;
}

// --- 2. SINGLE MATCH FETCHER (For Details Page & Live Label) ---
export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
    
    // Default Fallback (Database Data)
    const baseData: UnifiedMatchData = {
        status: dbData.status === 'SCHEDULED' ? 'PRE' : (dbData.status === 'FT' ? 'FT' : 'LIVE'),
        displayClock: dbData.status === 'LIVE' ? 'Live' : '',
        home: { name: dbData.home_team, logo: dbData.home_logo, score: dbData.home_score ?? 0, id: 'home' },
        away: { name: dbData.away_team, logo: dbData.away_logo, score: dbData.away_score ?? 0, id: 'away' },
        goals: [],
        stats: { possession: { h:0, a:0 }, shots: { h:0, a:0 }, corners: { h:0, a:0 }, fouls: { h:0, a:0 } },
        lineups: { home: [], away: [] },
        hasExternalData: false
    };

    try {
        const fetchOptions: any = { next: { revalidate: 45 }, signal: AbortSignal.timeout(5000) };
        let json = null;

        // 👇👇 🔄 API SWITCH: CHANGE URL HERE 👇👇
        // Strategy 1: Fetch by ID
        if (dbData.api_id) {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbData.api_id}`, fetchOptions);
            if (res.ok) json = await res.json();
        }
        // Strategy 2: Search (Backup)
        if (!json || !json.header) {
             const dateStr = new Date(dbData.match_date).toISOString().slice(0, 10).replace(/-/g, "");
             const searchRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${dateStr}`, fetchOptions);
             if (searchRes.ok) {
                 const searchJson = await searchRes.json();
                 const found = searchJson?.events?.find((e: any) => {
                     const n = e.name?.toLowerCase() || "";
                     return n.includes(dbData.home_team?.toLowerCase()) || n.includes(dbData.away_team?.toLowerCase());
                 });
                 if (found) {
                     const detailRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${found.id}`, fetchOptions);
                     if (detailRes.ok) json = await detailRes.json();
                 }
             }
        }
        // 👆👆 🔄 END URL CHANGE 👆👆

        // 👇👇 🔄 API SWITCH: ADAPT PARSING LOGIC HERE 👇👇
        if (json && json.header) {
            const comp = json.header.competitions?.[0];
            const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
            const box = json.boxscore;

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
                goals: comp?.details?.filter((e: any) => e.type?.text?.toLowerCase().includes('goal') && !e.type?.text?.toLowerCase().includes('missed')) || [],
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
        // 👆👆 🔄 END PARSING LOGIC 👆👆
    } catch (e) { }

    return baseData;
}

// --- 3. LEAGUE LIST FETCHER (For Sync Route) ---
export async function getLeagueMatches(leagueId: string, leagueName: string, dateStr: string) {
    const matches: any[] = [];
    
    try {
        // 👇👇 🔄 API SWITCH: CHANGE URL HERE 👇👇
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${dateStr}`, { next: { revalidate: 0 } });
        // 👆👆 🔄 END URL CHANGE 👆👆
        
        if (!res.ok) return [];
        const data = await res.json();
        
        // 👇👇 🔄 API SWITCH: ADAPT PARSING LOGIC HERE 👇👇
        if (data && data.events) {
            data.events.forEach((event: any) => {
                const competition = event.competitions[0];
                const home = competition.competitors.find((c: any) => c.homeAway === 'home');
                const away = competition.competitors.find((c: any) => c.homeAway === 'away');
                const state = event.status.type.state;

                let status = 'SCHEDULED';
                if (state === 'in') status = 'LIVE';
                if (state === 'post') status = 'FT';

                if (['pre', 'in', 'post'].includes(state)) {
                    matches.push({
                        api_id: event.id,
                        league: leagueName,
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
        // 👆👆 🔄 END PARSING LOGIC 👆👆
    } catch (error) { }
    
    return matches;
}