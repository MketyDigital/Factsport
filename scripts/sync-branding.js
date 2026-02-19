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

async function syncBranding() {
    console.log("🎨 Starting Visual Branding Sync (Backfill Mode)...");

    // 🟢 LOOK BACK 30 DAYS (Update Past & Future)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); 

    for (const [leagueName, leagueId] of Object.entries(LEAGUE_IDS)) {
        console.log(`\nProcessing ${leagueName}...`);
        
        try {
            // 1. Fetch League Banner
            const leagueUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookupleague.php?id=${leagueId}`;
            const leagueRes = await fetch(leagueUrl);
            const leagueData = await leagueRes.json();
            const leagueBanner = leagueData.leagues ? leagueData.leagues[0].strBanner : null; 

            // 2. Fetch Teams
            const teamsUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/lookup_all_teams.php?id=${leagueId}`;
            const teamsRes = await fetch(teamsUrl);
            const teamsData = await teamsRes.json();

            if (!teamsData.teams) continue;

            let updateCount = 0;

            for (const team of teamsData.teams) {
                // Update matches where this team is HOME
                // Uses % wildcards to help match "Man City" to "Manchester City"
                const { error, count } = await supabase
                    .from('matches')
                    .update({
                        home_stadium: team.strStadiumThumb || team.strStadium,
                        home_fanart: team.strTeamFanart1,
                        home_jersey: team.strTeamJersey,
                        home_logo: team.strTeamBadge, 
                        league_banner: leagueBanner 
                    })
                    .ilike('home_team', `%${team.strTeam}%`) 
                    .gte('match_date', startDate.toISOString()); // 🟢 From 30 days ago

                if (error) console.error(`   ❌ DB Error: ${error.message}`);
                
                // Only log if we actually updated rows to reduce noise
                // Note: Supabase doesn't always return 'count' in some configs, 
                // so we just log the attempt for major teams.
                if (['Arsenal', 'Chelsea', 'Liverpool', 'Real Madrid', 'Barcelona'].includes(team.strTeam)) {
                     console.log(`   ✅ Synced data for: ${team.strTeam}`);
                }
            }
            console.log(`   ✨ Finished ${leagueName}`);
            
        } catch (e) {
            console.error(`   🔥 Error: ${e.message}`);
        }
    }
}

syncBranding();