import { createClient } from '@/app/lib/supabase/client';

// ✅ HELPER 1: Text Cleaner (Removes "right footed shot", "following a fast break", etc)
const cleanPlayerName = (text: string) => {
    if (!text) return "Goal";
    
    // 1. Remove prefixes like "Goal! Team 1-0." or "Own Goal by"
    let clean = text.replace(/^Goal!.*?\.\s*/, '').replace(/^Own Goal by\s*/i, '');

    // 2. Stop at the first parenthesis (Team Name)
    if (clean.includes('(')) {
        clean = clean.split('(')[0];
    }

    // 3. Stop at "junk" phrases
    const stopWords = [
        'right footed', 'left footed', 'header', 'penalty', 'shot', 
        'from the', 'following', 'conceded', 'deflected'
    ];
    let lowestIndex = clean.length;
    stopWords.forEach(word => {
        const idx = clean.indexOf(word);
        if (idx !== -1 && idx < lowestIndex) lowestIndex = idx;
    });
    
    return clean.substring(0, lowestIndex).trim();
};

// ✅ HELPER 2: Assist Extractor (Removes "with a cross", etc)
const extractAssist = (text: string) => {
    if (!text || !text.toLowerCase().includes('assisted by')) return null;
    
    const parts = text.split(/Assisted by/i);
    if (parts.length > 1) {
        let assistPart = parts[1].trim();
        // Stop at common descriptions
        const stopWords = ['with a', 'following', 'header', 'via', '.'];
        let lowestIndex = assistPart.length;
        stopWords.forEach(word => {
            const idx = assistPart.indexOf(word);
            if (idx !== -1 && idx < lowestIndex) lowestIndex = idx;
        });
        return assistPart.substring(0, lowestIndex).trim();
    }
    return null;
};

// ✅ HELPER 3: Commentary Formatter
const formatCommentary = (playByPlay: any[]) => {
    if (!playByPlay) return [];
    return playByPlay.slice(0, 50).map((p: any) => ({
        id: p.id,
        time: p.clock?.displayValue || "",
        text: p.text || "No commentary available.",
        type: p.type?.text || "General" 
    }));
};

export interface UnifiedMatchData {
    status: string;
    displayClock: string;
    home: { name: string; logo: string; score: number | string; id: string };
    away: { name: string; logo: string; score: number | string; id: string };
    goals: any[];
    commentary: any[];
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
        commentary: [], 
        stats: { possession: { h:0, a:0 }, shots: { h:0, a:0 }, corners: { h:0, a:0 }, fouls: { h:0, a:0 } },
        lineups: { home: [], away: [] },
        hasExternalData: false
    };

    try {
        const fetchOptions: any = { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) };
        let json = null;

        if (dbData.api_id) {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${dbData.api_id}`, fetchOptions);
            if (res.ok) json = await res.json();
        }

        if (json && json.header) {
            const comp = json.header.competitions?.[0];
            const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
            const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
            const box = json.boxscore;
            
            const homeId = homeComp?.team?.id || 'home';
            const awayId = awayComp?.team?.id || 'away';
            
            const homeName = homeComp?.team?.name || baseData.home.name;
            const awayName = awayComp?.team?.name || baseData.away.name;

            const getStat = (teamId: string, statName: string) => {
                const team = box?.teams?.find((t: any) => String(t.team?.id) === String(teamId));
                return parseInt(team?.statistics?.find((s: any) => s.name === statName)?.displayValue || '0');
            };

            const getRoster = (teamId: string, idx: number) => {
                const team = json.rosters?.find((r: any) => String(r.team?.id) === String(teamId));
                return team ? team.roster : (json.rosters?.[idx]?.roster || []);
            };

            // ✅ SMART GOAL PARSING
            let finalGoals: any[] = [];
            
            // 1. Try Standard Details first
            if (comp?.details) {
                finalGoals = comp.details
                    .filter((e: any) => e.type?.text?.toLowerCase().includes('goal') && !e.type?.text?.toLowerCase().includes('missed'))
                    .map((e: any) => ({
                        player: e.participants?.[0]?.athlete?.displayName || "Goal",
                        time: e.clock?.displayValue || "",
                        type: 'goal',
                        team: String(e.team?.id) === String(homeId) ? 'home' : 'away',
                        assist: e.participants?.[1]?.athlete?.displayName || null
                    }));
            }

            // 2. Fallback to Commentary (with clean text logic)
            if (finalGoals.length === 0 && json.commentary) {
                finalGoals = json.commentary
                    .filter((p: any) => {
                        const t = (p.text || "").toLowerCase();
                        return p.type?.text === 'Goal' || t.startsWith('goal') || t.includes('own goal');
                    })
                    .map((p: any) => {
                        const text = p.text || "";
                        const isOwnGoal = text.toLowerCase().includes("own goal");
                        let isHome = false;

                        // Determine Side
                        if (p.team?.id) isHome = String(p.team.id) === String(homeId);
                        else if (text.includes(homeComp?.team?.name)) isHome = true;
                        
                        // ⚡ Flip side for Own Goals
                        if (isOwnGoal) isHome = !isHome;

                        return {
                            player: cleanPlayerName(text),
                            time: p.clock?.displayValue || "",
                            type: 'goal',
                            team: isHome ? 'home' : 'away',
                            assist: extractAssist(text)
                        };
                    });
            }

            return {
                status: comp?.status?.type?.state || baseData.status,
                displayClock: comp?.status?.displayClock || '',
                home: { 
                    name: homeName, 
                    logo: homeComp?.team?.logos?.[0]?.href || baseData.home.logo, 
                    score: homeComp?.score ?? baseData.home.score,
                    id: homeComp?.team?.id
                },
                away: { 
                    name: awayName, 
                    logo: awayComp?.team?.logos?.[0]?.href || baseData.away.logo, 
                    score: awayComp?.score ?? baseData.away.score,
                    id: awayComp?.team?.id
                },
                goals: finalGoals, 
                commentary: formatCommentary(json.commentary || []), 
                stats: {
                    possession: { h: getStat(homeId, 'possessionPct'), a: getStat(awayId, 'possessionPct') },
                    shots: { h: getStat(homeId, 'shotsSummary'), a: getStat(awayId, 'shotsSummary') },
                    corners: { h: getStat(homeId, 'corners'), a: getStat(awayId, 'corners') },
                    fouls: { h: getStat(homeId, 'foulsCommitted'), a: getStat(awayId, 'foulsCommitted') },
                },
                lineups: {
                    home: getRoster(homeId, 0)?.filter((p:any) => p.starter) || [],
                    away: getRoster(awayId, 1)?.filter((p:any) => p.starter) || []
                },
                hasExternalData: true
            };
        }
    } catch (e) { }
    return baseData;
}

export async function getLeagueMatches(leagueId: string, leagueName: string, dateStr: string) {
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
                      // Basic fallback for match list
                      const matchEvents = competition.details?.filter((e:any)=>e.type?.text?.includes('Goal')).map((e:any)=>({
                          player: e.participants?.[0]?.athlete?.shortName || "Goal",
                          time: e.clock?.displayValue || "",
                          team: e.team?.id === home.team.id ? 'home' : 'away'
                      })) || [];

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