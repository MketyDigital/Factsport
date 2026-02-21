const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys."); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

async function generateDailySummaries() {
    console.log("🌙 Starting Daily Matchday Analysis...");

    const today = new Date();
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
        
        const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
        if (existing) {
            console.log(`   ⏩ Already reported: ${leagueName}`);
            continue;
        }

        console.log(`   ✍️ Writing Summary for ${leagueName}...`);

        // 3. Prepare AI Prompt
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
            - Headline: Catchy (e.g., "Arsenal Stun City"). Keep it under 10 words.
            - Content: Summary of the action, key games, and table implications.
            - Length: 300 words.
            - Output: Plain text only. Do not use asterisks for bolding.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
            const body = lines.slice(1).join('\n').trim();

            const isBigLeague = ['Premier League', 'Champions League', 'La Liga'].includes(leagueName);

            // 🟢 FIND TOP 4 TEAMS FOR THIS LEAGUE'S COLLAGE
            let topLogos = [];
            leagueMatches.forEach(g => {
                if (topLogos.length < 4 && !topLogos.includes(g.home_logo)) topLogos.push(g.home_logo);
                if (topLogos.length < 4 && !topLogos.includes(g.away_logo)) topLogos.push(g.away_logo);
            });

            // 🟢 GENERATE THE DYNAMIC COVER IMAGE URL
            const titleParam = encodeURIComponent(`${leagueName} Roundup`);
            const logosParam = encodeURIComponent(topLogos.join(','));
            const dynamicCoverImage = `/api/og/daily?title=${titleParam}&logos=${logosParam}&type=summary`;

            const { error } = await supabase.from('news').insert([{
                title: headline,
                slug: reportSlug,
                body: body,
                image_url: dynamicCoverImage, 
                team_1_logo: null, 
                team_2_logo: null,
                is_breaking: true,         
                is_headline: isBigLeague   
            }]);

            if (error) {
                console.error(`   ❌ Supabase DB Error:`, error.message);
                console.error(`   Details:`, error.details || error.hint);
            } else {
                console.log(`   ✅ Published: ${headline}`);
            }

        } catch (e) {
            console.error(`   🔥 Gemini Error: ${e.message}`);
        }
    }
}

generateDailySummaries();