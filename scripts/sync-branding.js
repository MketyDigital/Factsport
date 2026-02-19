// scripts/sync-branding.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPORTSDB_KEY = '3'; 

if (!SUPABASE_URL || !SUPABASE_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEAGUE_IDS = {
    'Premier League': '4328',
    'La Liga': '4335',
    'Bundesliga': '4331',
    'Serie A': '4332',
    'Ligue 1': '4334',
    'Champions League': '4480'
};

// 🟢 SMART DICTIONARY: Maps your DB's short names to Official Search Names
const SEARCH_ALIASES = {
    'c palace': 'Crystal Palace',
    'nottm forest': 'Nottingham Forest',
    'nottingham': 'Nottingham Forest',
    'man united': 'Manchester United',
    'man city': 'Manchester City',
    'spurs': 'Tottenham',
    'wolves': 'Wolverhampton',
    'brighton hove': 'Brighton',
    'sheff utd': 'Sheffield United',
    'barça': 'Barcelona',
    'atleti': 'Atletico Madrid',
    'atlético': 'Atletico Madrid',
    'm\'gladbach': 'Monchengladbach',
    'gladbach': 'Monchengladbach',
    'hsv': 'Hamburg',
    'roma': 'AS Roma',
    'milan': 'AC Milan',
    'inter': 'Inter Milan',
    'inter milan': 'Inter Milan',
    'psg': 'Paris SG',
    'bayern': 'Bayern Munich',
    'dortmund': 'Borussia Dortmund',
    'leverkusen': 'Bayer Leverkusen',
    'leipzig': 'RB Leipzig',
    'frankfurt': 'Eintracht Frankfurt',
    'köln': 'FC Koln',
    '1. fc köln': 'FC Koln',
    'cologne': 'FC Koln',
    'bremen': 'Werder Bremen',
    'stuttgart': 'VfB Stuttgart',
    'freiburg': 'SC Freiburg',
    'augsburg': 'FC Augsburg',
    'mainz': 'Mainz 05',
    'union berlin': 'Union Berlin',
    'heidenheim': 'Heidenheim',
    'st. pauli': 'St Pauli',
    'bodo/glimt': 'Bodo Glimt',
    'bodø/glimt': 'Bodo Glimt',
    'qarabağ ağdam': 'Qarabag',
    'slavia praha': 'Slavia Prague',
    'paphos fc': 'Pafos',
    'como 1907': 'Como',
    'ac pisa': 'Pisa',
    'angers sco': 'Angers',
    'olympique lyon': 'Lyon',
    'stade rennais': 'Rennes',
    'fc metz': 'Metz',
    'rc lens': 'Lens'
};

// 🟢 Prepare the name for TheSportsDB Search API
const normalizeForSearch = (name) => {
    let cleanName = name.toLowerCase().trim();
    // Check if we have an exact alias for it
    if (SEARCH_ALIASES[cleanName]) {
        cleanName = SEARCH_ALIASES[cleanName];
    }
    // Remove accents (é -> e) to ensure search works
    return cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

async function syncBranding() {
    console.log("🎨 Starting Direct-Search Branding Sync...");

    const startDate = new Date(); 
    startDate.setDate(startDate.getDate() - 30); // Look back 30 days to catch recent matches

    // 1. Fetch matches from DB
    const { data: dbMatches, error } = await supabase
        .from('matches')
        .select('home_team, league')
        .gte('match_date', startDate.toISOString());

    if (error || !dbMatches) {
        console.error("❌ Could not fetch matches from DB:", error);
        return;
    }

    // 2. Group teams by league
    const dbTeamsByLeague = {};
    dbMatches.forEach(m => {
        if (!dbTeamsByLeague[m.league]) dbTeamsByLeague[m.league] = new Set();
        dbTeamsByLeague[m.league].add(m.home_team);
    });

    // 3. Process each league
    for (const [leagueName, expectedLeagueId] of Object.entries(LEAGUE_IDS)) {
        console.log(`\nProcessing ${leagueName}...`);
        
        try {
            const dbTeamList = Array.from(dbTeamsByLeague[leagueName] || []);
            if (dbTeamList.length === 0) {
                console.log("   ⚠️ No teams found in DB.");
                continue;
            }

            // A. Fetch League Banner (With Fallback Logic)
            const leagueUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookupleague.php?id=${expectedLeagueId}`;
            const leagueRes = await fetch(leagueUrl);
            const leagueData = await leagueRes.json();
            
            let leagueBanner = null;
            if (leagueData.leagues && leagueData.leagues[0]) {
                const l = leagueData.leagues[0];
                // Grabs the banner, or falls back to the logo, or falls back to the square badge
                leagueBanner = l.strBanner || l.strLogo || l.strBadge || null;
            }

            // B. Direct Search for each Team
            for (const dbTeamName of dbTeamList) {
                const searchName = normalizeForSearch(dbTeamName);
                const teamsUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(searchName)}`;
                
                const teamsRes = await fetch(teamsUrl);
                const teamsData = await teamsRes.json();

                let bestMatch = null;

                if (teamsData.teams) {
                    // Lock 1: Try to match the exact league first (TSDB teams can have up to 7 leagues)
                    bestMatch = teamsData.teams.find(t => 
                        t.idLeague === expectedLeagueId || 
                        t.idLeague2 === expectedLeagueId || 
                        t.idLeague3 === expectedLeagueId || 
                        t.idLeague4 === expectedLeagueId || 
                        t.idLeague5 === expectedLeagueId || 
                        t.idLeague6 === expectedLeagueId || 
                        t.idLeague7 === expectedLeagueId
                    );
                    
                    // Lock 2: If no exact league match (e.g., Champions League teams playing domestically), take the top result
                    if (!bestMatch) {
                        bestMatch = teamsData.teams[0];
                    }
                }

                if (bestMatch) {
                    // Overwrite the DB row (this fixes any previous bad data!)
                    const { error } = await supabase
                        .from('matches')
                        .update({
                            home_stadium: bestMatch.strStadiumThumb || bestMatch.strStadium,
                            home_fanart: bestMatch.strTeamFanart1,
                            home_jersey: bestMatch.strTeamJersey,
                            home_logo: bestMatch.strTeamBadge, 
                            league_banner: leagueBanner 
                        })
                        .eq('home_team', dbTeamName) 
                        .gte('match_date', startDate.toISOString());

                    if (error) {
                        console.error(`   ❌ Failed to update ${dbTeamName}:`, error.message);
                    } else {
                        console.log(`   ✅ Synced: ${dbTeamName} -> ${bestMatch.strTeam}`);
                    }
                } else {
                    console.log(`   ⚠️ Could not find image for: ${dbTeamName} (Searched: "${searchName}")`);
                }
                
                // Be polite to the free API (Avoid Rate Limits)
                await new Promise(r => setTimeout(r, 200));
            }
            
        } catch (e) {
            console.error(`   🔥 Error: ${e.message}`);
        }
    }
    console.log("\n✨ Sync Complete.");
}

syncBranding();