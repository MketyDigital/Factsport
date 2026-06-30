export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    
    if (searchParams.get('key') !== process.env.CRON_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forceSync = searchParams.get('force') === 'true';

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const API_KEY = process.env.FOOTBALL_DATA_KEY;
    if (!API_KEY) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

    // 🟢 ADDED TOURNAMENT CODES
    const TARGET_LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'EC', 'WC', 'CLI', 'AFCON'];
    
    const ESPN_LEAGUES: Record<string, string> = {
        'PL': 'eng.1', 'PD': 'esp.1', 'BL1': 'ger.1', 'SA': 'ita.1', 'FL1': 'fra.1',
        'CL': 'uefa.champions', 'EC': 'uefa.euro', 'WC': 'fifa.world',
        'CLI': 'conmebol.america', 'AFCON': 'caf.nations'
    };

    const parseEspnStandings = (espnRes: any, leagueId: string) => {
        if (!espnRes) return null;
        const parsedStandings: any[] = [];
        const processEntries = (entries: any[], groupName: string | null) => {
            const table = entries.map((entry: any, index: number) => {
                const getStat = (name: string) => {
                    const stat = entry.stats?.find((s: any) => s.name === name || s.abbreviation === name);
                    return stat ? parseInt(stat.value || stat.displayValue || '0') : 0;
                };
                return {
                    league_code: leagueId,
                    match_group: groupName,
                    position: getStat('rank') || (index + 1),
                    team_id: entry.team?.id,
                    team_name: entry.team?.displayName || entry.team?.name,
                    team_short_name: entry.team?.shortDisplayName || entry.team?.name,
                    team_crest: entry.team?.logos?.[0]?.href,
                    played_games: getStat('gamesPlayed') || getStat('GP') || 0,
                    won: getStat('wins') || getStat('W') || 0,
                    draw: getStat('ties') || getStat('D') || 0,
                    lost: getStat('losses') || getStat('L') || 0,
                    goal_difference: getStat('pointDifferential') || getStat('GD') || 0,
                    points: getStat('points') || getStat('P') || 0,
                    updated_at: new Date().toISOString()
                };
            });
            return table;
        };

        let allTables: any[] = [];
        if (espnRes.children && espnRes.children.length > 0) {
            espnRes.children.forEach((child: any) => {
                const groupName = child.name || child.abbreviation;
                if (child.standings?.entries) {
                    allTables = allTables.concat(processEntries(child.standings.entries, groupName));
                }
            });
        } else if (espnRes.standings && espnRes.standings.entries) {
            allTables = allTables.concat(processEntries(espnRes.standings.entries, null));
        }
        return allTables.length > 0 ? allTables : null;
    };

    try {
        const today = new Date();
        const fromDate = new Date(today); 
        fromDate.setDate(today.getDate() - 2); 
        const toDate = new Date(today); 
        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        let matchesFinalized = 0; 
        let standingsUpdated = 0;
        let logs: string[] = [];
        const leaguesNeedingStandingsUpdate = new Set<string>();

        const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${fromStr}&dateTo=${toStr}`, { 
            headers: { 'X-Auth-Token': API_KEY } 
        });

        if (res.ok) {
            const data = await res.json();
            const fdMatches = data.matches || [];

            if (fdMatches.length > 0) {
                const apiIds = fdMatches.map((m: any) => m.id);
                const { data: dbMatches } = await supabase
                    .from('matches')
                    .select('*') 
                    .in('api_id', apiIds);

                const dbMap = new Map(dbMatches?.map(m => [m.api_id, m]) || []);
                const matchUpdates: any[] = []; 

                for (const m of fdMatches) {
                    const compCode = m.competition?.code;
                    if (!TARGET_LEAGUES.includes(compCode)) continue;
                    
                    let fdStatusMapped = 'SCHEDULED';
                    if (['FINISHED', 'AWARDED'].includes(m.status)) {
                        fdStatusMapped = 'FT';
                    } else if (['IN_PLAY', 'PAUSED'].includes(m.status)) {
                        fdStatusMapped = m.status === 'PAUSED' ? 'HT' : 'LIVE';
                    } else if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(m.status)) {
                        fdStatusMapped = 'POSTPONED';
                    } else if (['TIMED', 'SCHEDULED'].includes(m.status)) {
                        fdStatusMapped = 'SCHEDULED';
                    } else {
                        fdStatusMapped = m.status;
                    }
                    
                    const dbMatch = dbMap.get(m.id);
                    if (!dbMatch) continue;

                    const isDbLive = ['LIVE', 'HT', '1H', '2H', 'ET', 'P'].includes(dbMatch.status);
                    const hasEspnId = !!dbMatch.espn_id;
                    
                    const fdHomeScore = m.score?.fullTime?.home ?? 0;
                    const fdAwayScore = m.score?.fullTime?.away ?? 0;
                    let shouldUpdateMatch = false;

                    // Trigger standings update if active
                    if (['LIVE', 'HT', 'FT', 'FINISHED', 'AWARDED'].includes(fdStatusMapped) || isDbLive) {
                        leaguesNeedingStandingsUpdate.add(compCode);
                    }

                    // Strict Update Logic
                    if (fdStatusMapped === 'FT') {
                        // We check FT regardless of espn_id to verify final scores
                        if (dbMatch.status !== 'FT' || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                            shouldUpdateMatch = true;
                            leaguesNeedingStandingsUpdate.add(compCode); 
                        }
                    } 
                    else if (hasEspnId) {
                        // Skip Scheduled, Live, Postponed, etc., if the match has an ESPN ID
                        continue; 
                    } 
                    else if (['LIVE', 'HT'].includes(fdStatusMapped)) {
                        // No ESPN ID: Update live scores
                        if (dbMatch.status !== fdStatusMapped || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                            shouldUpdateMatch = true;
                        }
                    }
                    else if (['POSTPONED', 'SCHEDULED'].includes(fdStatusMapped)) {
                        // No ESPN ID: Update pre-match statuses
                        if (dbMatch.status !== fdStatusMapped && !isDbLive) {
                            shouldUpdateMatch = true;
                        }
                    }

                    if (shouldUpdateMatch) {
                        matchUpdates.push(
                            supabase.from('matches').update({ 
                                home_score: fdHomeScore, 
                                away_score: fdAwayScore, 
                                status: fdStatusMapped, 
                                updated_at: new Date().toISOString() 
                            }).eq('api_id', m.id).then()
                        );
                        matchesFinalized++; 
                        logs.push(`Cron Sync: ${m.id} (${compCode}) -> ${fdStatusMapped} ${fdHomeScore}-${fdAwayScore}`);
                    }
                }

                if (matchUpdates.length > 0) await Promise.all(matchUpdates);
            }
        }

        const { data: existingStandings } = await supabase.from('standings').select('league_code');
        const presentLeagues = new Set(existingStandings?.map(s => s.league_code) || []);
        
        TARGET_LEAGUES.forEach(league => {
            if (!presentLeagues.has(league)) {
                leaguesNeedingStandingsUpdate.add(league);
                logs.push(`🛡️ Self-Healing Triggered: ${league} table fetched.`);
            }
        });

        const currentMinutes = today.getUTCMinutes();
        const isHalfHourInterval = (currentMinutes >= 0 && currentMinutes < 5) || (currentMinutes >= 30 && currentMinutes < 35);
        
        if (isHalfHourInterval || forceSync) {
            TARGET_LEAGUES.forEach(league => leaguesNeedingStandingsUpdate.add(league));
            logs.push(`⏱️ Background Clock Audit: Syncing tables.`);
        }

        const targetStandingsLeagues = Array.from(leaguesNeedingStandingsUpdate);

        if (targetStandingsLeagues.length > 0) {
            const standingsFetches = targetStandingsLeagues.map(async (leagueId) => {
                let res = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, { 
                    headers: { 'X-Auth-Token': API_KEY } 
                }).then(r => r.ok ? r.json() : null).catch(() => null);
                
                // ESPN FALLBACK for Cup rich standings if Football Data fails or is empty
                if (!res || !res.standings || res.standings.length === 0) {
                    const espnCode = ESPN_LEAGUES[leagueId];
                    if (espnCode) {
                        const espnRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/standings`).then(r => r.ok ? r.json() : null).catch(() => null);
                        const parsed = parseEspnStandings(espnRes, leagueId);
                        if (parsed) return { isEspn: true, table: parsed };
                    }
                }
                return res;
            });

            const standingsResults = await Promise.all(standingsFetches);
            let allStandingsToInsert: any[] = [];
            const successfulLeagues: string[] = [];

            standingsResults.forEach((standData, index) => {
                if (!standData) return;
                const leagueId = targetStandingsLeagues[index];
                
                if (standData.isEspn) {
                    allStandingsToInsert = allStandingsToInsert.concat(standData.table);
                    successfulLeagues.push(leagueId);
                    logs.push(`Standings Prepared (ESPN Fallback): ${leagueId}`);
                    return;
                }

                // 🟢 GROUP STANDINGS LOGIC APPLIED HERE (FD format)
                const allTables = standData?.standings?.filter((s: any) => s.type === 'TOTAL') || [];

                allTables.forEach((groupData: any) => {
                    const table = groupData.table || [];
                    const groupName = groupData.group || null;

                    if (table.length > 0) {
                        const mappedTable = table.map((entry: any) => ({
                            league_code: leagueId,
                            match_group: groupName ? groupName.replace(/_/g, ' ') : null, // Mapped Group A, B, C...
                            position: entry.position,
                            team_id: entry.team.id,
                            team_name: entry.team.name,
                            team_short_name: entry.team.shortName || entry.team.name,
                            team_crest: entry.team.crest,
                            played_games: entry.playedGames,
                            won: entry.won,
                            draw: entry.draw,
                            lost: entry.lost,
                            goal_difference: entry.goalDifference,
                            points: entry.points,
                            updated_at: new Date().toISOString()
                        }));
                        
                        allStandingsToInsert = allStandingsToInsert.concat(mappedTable);
                    }
                });

                if (allTables.length > 0) {
                    successfulLeagues.push(leagueId);
                    logs.push(`Standings Prepared: ${leagueId}`);
                }
            });

            if (allStandingsToInsert.length > 0 && successfulLeagues.length > 0) {
                await supabase.from('standings').delete().in('league_code', successfulLeagues);
                const { error: stdErr } = await supabase.from('standings').insert(allStandingsToInsert);
                
                if (!stdErr) {
                    standingsUpdated += allStandingsToInsert.length;
                } else {
                    logs.push(`Standings Insert Error: ${stdErr.message}`);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            matchesVerified: matchesFinalized, 
            standingsUpdated, 
            leaguesTriggered: targetStandingsLeagues,
            logs 
        });

    } catch (error: any) { 
        return NextResponse.json({ error: error.message }, { status: 500 }); 
    }
}