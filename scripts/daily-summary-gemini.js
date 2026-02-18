// scripts/daily-summary-gemini.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const SPORTSDB_KEY = '3'; // Public test key

// Fail gracefully if keys are missing
if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys. Check GitHub Secrets."); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 🖼️ Helper: Fetch a High-Res "Fanart" Image
async function getHeroImage(teamName) {
    try {
        console.log(`   🖼️ Fetching hero image for: ${teamName}`);
        const url = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.teams && data.teams[0]) {
            return data.teams[0].strTeamFanart1 || data.teams[0].strStadiumThumb || data.teams[0].strTeamBadge;
        }
    } catch (e) {
        console.error("Image Fetch Error:", e.message);
    }
    return null; 
}

async function generateDailySummaries() {
    console.log("🌙 Starting Daily Matchday Analysis...");

    const today = new Date();
    // Set strictly to today's range
    const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
    const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();
    const dateSlug = today.toISOString().split('T')[0];

    // 1. Fetch Finished Matches
    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FT')
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay);

    if (!matches || matches.length === 0) {
        console.log("   💤 No finished matches today.");
        return;
    }

    // 2. Group by League
    const leagues = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        if (leagueMatches.length < 1) continue; 

        const reportSlug = `${leagueName.toLowerCase().replace(/\s+/g, '-')}-roundup-${dateSlug}`;
        
        // Prevent Duplicates
        const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
        if (existing) {
            console.log(`   ⏩ Already reported: ${leagueName}`);
            continue;
        }

        console.log(`   ✍️ Writing Summary for ${leagueName}...`);

        // 3. Find "Main Event" for Image
        const mainMatch = leagueMatches.sort((a, b) => (b.home_score + b.away_score) - (a.home_score + a.away_score))[0];
        let heroImage = await getHeroImage(mainMatch.home_team);
        if (!heroImage) heroImage = mainMatch.home_logo;

        // 4. Prepare AI Prompt
        const matchSummaries = leagueMatches.map(m => {
            const scorers = (m.match_events || [])
                .filter(e => e.type === 'goal')
                .map(e => `${e.player} (${e.time})`)
                .join(', ');
            return `- ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (Scorers: ${scorers || 'None'})`;
        }).join('\n');

        const prompt = `
            You are a senior football analyst for 'FactSport'.
            Write a "Matchday Round-Up" article for the ${leagueName} played on ${dateSlug}.
            
            Results:
            ${matchSummaries}

            Guidelines:
            - Headline: Catchy (e.g., "Arsenal Stun City").
            - Content: Summary of the action, key games, and table implications.
            - Length: 300 words.
            - Output: Plain text only.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headline = lines[0].replace(/^#+\s*/, '').replace(/"/g, ''); 
            const body = lines.slice(1).join('\n').trim();

            // 🟢 LOGIC: Premier League or Champions League = Headline Slider
            const isBigLeague = ['Premier League', 'Champions League', 'La Liga'].includes(leagueName);

            const { error } = await supabase.from('news').insert({
                title: headline,
                slug: reportSlug,
                body: body, // Matches your Admin Panel
                image_url: heroImage, 
                source_name: 'FactSport Analysis',
                published_at: new Date().toISOString(),
                
                // 🟢 AUTO TICKER & HEADLINE SETTINGS
                is_breaking: true,         // ALL summaries go to Ticker
                is_headline: isBigLeague,  // Only Big Leagues go to Slider
                
                team_1_logo: mainMatch.home_logo,
                team_2_logo: mainMatch.away_logo
            });

            if (error) console.error("DB Error:", error.message);
            else console.log(`   ✅ Published: ${headline}`);

        } catch (e) {
            console.error(`   🔥 Gemini Error: ${e.message}`);
        }
    }
}

generateDailySummaries();