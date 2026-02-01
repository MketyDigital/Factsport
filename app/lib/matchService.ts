import { createClient } from '@/app/lib/supabase/client';

// ✅ HELPER 1: Extracts Goals from Main Details (Standard API Data)
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
         time: e.clock?.displayValue || "",
         type: 'goal',
         team: isHome ? 'home' : 'away',
         assist: e.participants?.[1]?.athlete?.displayName || null
       };
    });
};

// ✅ HELPER 2: Fallback - Advanced Text Parsing (Fixes Own Goals & Messy Text)
const fallbackGoalsFromCommentary = (playByPlay: any[], homeId: string, awayId: string, homeName: string, awayName: string) => {
    if (!playByPlay) return [];
    
    return playByPlay
        .filter((p: any) => {
            const t = (p.text || "").toLowerCase();
            return p.type?.text === 'Goal' || t.startsWith('goal') || t.includes('own goal');
        })
        .map((p: any) => {
            const text = p.text || "";
            const lowerText = text.toLowerCase();
            const isOwnGoal = lowerText.includes("own goal");

            // 1. DETERMINE TEAM
            let isHome = false; 
            
            // Priority A: API Team ID
            if (p.team?.id) {
                isHome = String(p.team.id) === String(homeId);
            } 
            // Priority B: Check for Team Name in text
            else {
                // If text contains Home Name (e.g. "Leeds United"), assume Home... 
                // BUT if it's an Own Goal, we will flip this later.
                if (lowerText.includes(homeName.toLowerCase())) isHome = true;
                else if (lowerText.includes(awayName.toLowerCase())) isHome = false;
            }

            // ⚡ CRITICAL FIX: FLIP SIDE FOR OWN GOALS
            // If "Own Goal by [HomePlayer]", the point goes to [AwayTeam].
            if (isOwnGoal) {
                isHome = !isHome;
            }

            // 2. EXTRACT PLAYER NAME (Aggressive Cleaning)
            let playerName = "Goal";

            if (p.participants?.[0]?.athlete?.displayName) {
                playerName = p.participants[0].athlete.displayName;
            } 
            else if (isOwnGoal) {
                // Format: "Own Goal by Karl Darlow, Leeds United. Leeds United 0..."
                // Regex: Match text between "by" and the first comma/dot
                const match = text.match(/Own Goal by (.*?)(,|\.| \d)/);
                if (match && match[1]) playerName = match[1].trim();
                else playerName = "Own Goal"; // Fallback
            } 
            else {
                // Format: "Goal!  Liverpool 4, Newcastle 1. Anthony Gordon (Newcastle)..."
                // Step A: Remove the "Goal! ... Score." prefix part
                // We look for the first occurrence of a Period followed by Space + Letter, or a parenthesis
                let clean = text.replace(/^Goal!.*?\.\s+/, ''); 
                
                // If text still starts with Score (e.g. "Liverpool 4..."), strip it manually
                // Look for the first player-like string (text before '(', 'right footed', 'header')
                const splitMarkers = ['(', 'right footed', 'left footed', 'header', 'penalty', 'shot'];
                let cutIndex = clean.length;
                
                splitMarkers.forEach(marker => {
                    const idx = clean.indexOf(marker);
                    if (idx !== -1 && idx < cutIndex) cutIndex = idx;
                });

                playerName = clean.substring(0, cutIndex).trim();

                // Final cleanup: If name still contains numbers or "Goal", just say "Goal"
                if (playerName.match(/\d/) || playerName.length > 25) playerName = "Goal";
            }

            // 3. EXTRACT ASSIST
            let assistName = null;
            if (lowerText.includes('assisted by')) {
                const parts = text.split(/Assisted by/i);
                if (parts.length > 1) {
                    assistName = parts[1].split(/[.,]/)[0].trim();
                }
            }

            // 4. EXTRACT TIME
            let time = p.clock?.displayValue || "";
            if (!time && text.match(/^(\d+)'/)) {
                time = text.match(/^(\d+)'/)[0];
            }

            return {
                player: playerName, 
                time: time,
                type: 'goal',
                team: isHome ? 'home' : 'away',
                assist: assistName 
            };
        });
};

// ✅ HELPER 3: Commentary
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

            // ✅ MERGE LOGIC
            let finalGoals = formatMatchEvents(comp?.details, homeId);
            if (finalGoals.length === 0 && json.commentary) {
                finalGoals = fallbackGoalsFromCommentary(json.commentary, homeId, awayId, homeName, awayName);
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