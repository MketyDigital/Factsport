// scripts/sync-branding.js
const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPORTSDB_KEY = '3'; // Public test key

if (!SUPABASE_URL || !SUPABASE_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map common leagues to TheSportsDB IDs
const LEAGUE_IDS = {
    'Premier League': '4328',
    'La Liga': '4335',
    'Bundesliga': '4331',
    'Serie A': '4332',
    'Ligue 1': '4334',
    'Champions League': '4480',
    'FA Cup': '4329' 
};

async function syncBranding() {
    console.log("🎨 Starting Visual Branding Sync...");

    for (const [leagueName, leagueId] of Object.entries(LEAGUE_IDS)) {
        console.log(`\nProcessing ${leagueName} (ID: ${leagueId})...`);
        
        try {
            // 1. Fetch League Details (for Banner)
            const leagueUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookupleague.php?id=${leagueId}`;
            const leagueRes = await fetch(leagueUrl);
            const leagueData = await leagueRes.json();
            const leagueBanner = leagueData.leagues ? leagueData.leagues[0].strBanner : null; 

            // 2. Fetch All Teams in League
            const teamsUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookup_all_teams.php?id=${leagueId}`;
            const teamsRes = await fetch(teamsUrl);
            const teamsData = await teamsRes.json();

            if (!teamsData.teams) continue;

            // 3. Update Matches
            for (const team of teamsData.teams) {
                // Determine images
                const stadium = team.strStadiumThumb || team.strStadium; 
                const fanart = team.strTeamFanart1; 
                const jersey = team.strTeamJersey; 
                const logo = team.strTeamBadge;

                // Update FUTURE matches where this team is HOME
                // This gives the match page the "Home Stadium" vibe
                const { error } = await supabase
                    .from('matches')
                    .update({
                        home_stadium: stadium,
                        home_fanart: fanart,
                        home_jersey: jersey,
                        home_logo: logo, // Upgrade to high-res
                        league_banner: leagueBanner // Add league branding
                    })
                    .ilike('home_team', team.strTeam) // Fuzzy match name
                    .gte('match_date', new Date().toISOString()); 

                if (error) console.error(`   ❌ DB Error for ${team.strTeam}: ${error.message}`);
                // else console.log(`   ✅ Updated Branding: ${team.strTeam}`);
            }
            console.log(`   ✨ Finished ${leagueName}`);
            
        } catch (e) {
            console.error(`   🔥 Error processing ${leagueName}: ${e.message}`);
        }
    }
}

syncBranding();