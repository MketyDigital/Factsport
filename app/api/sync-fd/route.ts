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

                    if (['LIVE', 'HT', 'FT', 'FINISHED', 'AWARDED'].includes(fdStatusMapped) || isDbLive) {
                        leaguesNeedingStandingsUpdate.add(compCode);
                    }

                    if (fdStatusMapped === 'FT') {
                        if (dbMatch.status !== 'FT' || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                            shouldUpdateMatch = true;
                            leaguesNeedingStandingsUpdate.add(compCode); 
                            
                            const internalOrigin = new URL(request.url).origin;
                            const targetRecord = { ...dbMatch, home_score: fdHomeScore, away_score: fdAwayScore, status: 'FT' };
                            
                            fetch(`${internalOrigin}/api/socials`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
                                body: JSON.stringify({ record: targetRecord, old_record: dbMatch })
                            }).catch(e => console.error(" Late FT Broadcast Intercept Failed:", e.message));
                        }
                    } 
                    else if (hasEspnId && (fdStatusMapped === 'LIVE' || fdStatusMapped === 'HT' || isDbLive)) {
                        continue; 
                    } 
                    else if (!hasEspnId && ['LIVE', 'HT'].includes(fdStatusMapped)) {
                        if (dbMatch.status !== fdStatusMapped || dbMatch.home_score !== fdHomeScore || dbMatch.away_score !== fdAwayScore) {
                            shouldUpdateMatch = true;
                        }
                    }
                    else if (['POSTPONED', 'SCHEDULED'].includes(fdStatusMapped)) {
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
            const standingsFetches = targetStandingsLeagues.map(leagueId => 
                fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, { 
                    headers: { 'X-Auth-Token': API_KEY } 
                }).then(r => r.ok ? r.json() : null).catch(() => null)
            );

            const standingsResults = await Promise.all(standingsFetches);
            let allStandingsToInsert: any[] = [];
            const successfulLeagues: string[] = [];

            standingsResults.forEach((standData, index) => {
                if (!standData) return;
                const leagueId = targetStandingsLeagues[index];
                
                // 🟢 GROUP STANDINGS LOGIC APPLIED HERE
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