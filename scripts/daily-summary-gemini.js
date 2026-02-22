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
            // 🟢 AI UPGRADE: Feeding the Match ID to Gemini
            return `- MATCH ID: ${m.id} | ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (Scorers: ${scorers || 'None'})`;
        }).join('\n');

        // 🟢 AI UPGRADE: Strict Markdown Linking Instructions
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
            - CRITICAL LINKING RULE: You MUST wrap EVERY match you mention in a Markdown link pointing to its Match ID. 
              Format strictly as: [View Match Stats](/match/INSERT_MATCH_ID_HERE). Do this for every single game you discuss!
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
            const body = lines.slice(1).join('\n').trim();

            const isBigLeague = ['Premier League', 'Champions League', 'La Liga'].includes(leagueName);

            let featureMatch = leagueMatches[0];

            const { error } = await supabase.from('news').insert([{
                title: headline,
                slug: reportSlug,
                body: body,
                image_url: null, 
                team_1_logo: featureMatch ? featureMatch.home_logo : null, 
                team_2_logo: featureMatch ? featureMatch.away_logo : null,
                is_breaking: true,         
                is_headline: isBigLeague  
            }]);

            if (error) {
                console.error(`   ❌ Supabase DB Error:`, error.message);
            } else {
                console.log(`   ✅ Published: ${headline}`);
            }

        } catch (e) {
            console.error(`   🔥 Gemini Error: ${e.message}`);
        }
    }
}

generateDailySummaries();