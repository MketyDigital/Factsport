// scripts/sync-branding.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPORTSDB_KEY = '3'; 

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("❌ Missing Keys"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEAGUE_IDS = {
    'Premier League': '4328',
    'La Liga': '4335',
    'Bundesliga': '4331',
    'Serie A': '4332',
    'Ligue 1': '4334',
    'Champions League': '4480'
};

// 🟢 1. MATH LOGIC (Same as Live Route)
const normalize = (name) => {
    if (!name) return "";
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/ fc| cf| fk| sc| united| city| real| inter| ac| milan| athletic| hotspur| albion| & hove| wanderers| town| county| palace/g, '') 
        .trim();
};

const similarity = (s1, s2) => {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= longer.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[longer.length] = lastValue;
    }
    return (longerLength - costs[longer.length]) / longerLength;
};

async function syncBranding() {
    console.log("🎨 Starting Smart Visual Branding Sync...");

    // 🟢 1. GET ALL TEAMS FROM YOUR DB (Active Matches)
    // We only care about teams that actually have matches coming up or recently finished
    const startDate = new Date(); 
    startDate.setDate(startDate.getDate() - 30); // Look back 30 days

    const { data: dbMatches, error } = await supabase
        .from('matches')
        .select('home_team, league')
        .gte('match_date', startDate.toISOString());

    if (error || !dbMatches) {
        console.error("❌ Could not fetch matches from DB:", error);
        return;
    }

    // Create a unique list of teams per league from your DB
    // Format: { 'Premier League': ['Man City', 'Liverpool'], 'La Liga': [...] }
    const dbTeamsByLeague = {};
    dbMatches.forEach(m => {
        if (!dbTeamsByLeague[m.league]) dbTeamsByLeague[m.league] = new Set();
        dbTeamsByLeague[m.league].add(m.home_team);
    });

    // 🟢 2. PROCESS LEAGUES
    for (const [leagueName, leagueId] of Object.entries(LEAGUE_IDS)) {
        console.log(`\nProcessing ${leagueName}...`);
        
        try {
            const dbTeamList = Array.from(dbTeamsByLeague[leagueName] || []);
            if (dbTeamList.length === 0) {
                console.log("   ⚠️ No teams found in your DB for this league.");
                continue;
            }

            // A. Fetch League Banner
            const leagueUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookupleague.php?id=${leagueId}`;
            const leagueRes = await fetch(leagueUrl);
            const leagueData = await leagueRes.json();
            const leagueBanner = leagueData.leagues ? leagueData.leagues[0].strBanner : null; 

            // B. Fetch All Teams from TheSportsDB
            const teamsUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookup_all_teams.php?id=${leagueId}`;
            const teamsRes = await fetch(teamsUrl);
            const teamsData = await teamsRes.json();

            if (!teamsData.teams) continue;

            // 🟢 3. MATCH & UPDATE
            for (const dbTeamName of dbTeamList) {
                const normDbName = normalize(dbTeamName);

                // Find best match in TSDB
                const bestMatch = teamsData.teams.find(tsdbTeam => {
                    const normTsdb = normalize(tsdbTeam.strTeam);
                    
                    // Direct Includes
                    if (normDbName.includes(normTsdb) || normTsdb.includes(normDbName)) return true;
                    // Fuzzy Match
                    return similarity(normDbName, normTsdb) > 0.6;
                });

                if (bestMatch) {
                    // We found a match! Update ALL matches for this home team.
                    const { error } = await supabase
                        .from('matches')
                        .update({
                            home_stadium: bestMatch.strStadiumThumb || bestMatch.strStadium,
                            home_fanart: bestMatch.strTeamFanart1,
                            home_jersey: bestMatch.strTeamJersey,
                            home_logo: bestMatch.strTeamBadge, 
                            league_banner: leagueBanner 
                        })
                        .eq('home_team', dbTeamName) // Exact match on DB Name
                        .gte('match_date', startDate.toISOString());

                    if (error) console.error(`   ❌ Failed to update ${dbTeamName}`);
                    else console.log(`   ✅ Synced: ${dbTeamName} -> ${bestMatch.strTeam}`);
                } else {
                    console.log(`   ⚠️ Could not find image for: ${dbTeamName}`);
                }
            }
            
        } catch (e) {
            console.error(`   🔥 Error: ${e.message}`);
        }
    }
    console.log("\n✨ Sync Complete.");
}

syncBranding();