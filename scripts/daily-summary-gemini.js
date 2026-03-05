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

        const matchSummaries = leagueMatches.map(m => {
            const scorers = (m.match_events || [])
                .filter(e => e.type === 'goal')
                .map(e => `${e.player} (${e.time})`)
                .join(', ');
            return `- MATCH ID: ${m.id} | ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (Scorers: ${scorers || 'None'})`;
        }).join('\n');

        // 🟢 AI UPGRADE: Expert Post-Match Analyst
        const prompt = `
            You are a top-tier European football journalist and master tactical analyst writing for 'FactSport'.
            Write a deep, engaging "Matchday Round-Up" article for the ${leagueName} played on ${dateSlug}.
            
            Results:
            ${matchSummaries}

            Guidelines:
            - Headline: Catchy and dramatic, capturing the biggest storyline or shock of the day. Under 10 words.
            - Analysis: Don't just list the scores. Tell us *why* it happened. Focus on tactical shifts, manager decisions, shocking moments, and how these results drastically change the league table.
            - Narrative: Highlight the biggest winner and the biggest loser of the day. Write with a strong, human, journalistic voice that sparks debate.
            - Length: 400-500 words.
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

            let featureMatch = leagueMatches[0];

            const { error } = await supabase.from('news').insert([{
                title: headline,
                slug: reportSlug,
                body: body,
                image_url: null, 
                team_1_logo: featureMatch ? featureMatch.home_logo : null, 
                team_2_logo: featureMatch ? featureMatch.away_logo : null,
                is_breaking: false, 
                is_headline: false  
            }]);

            if (error) {
                console.error(`   ❌ Supabase DB Error:`, error.message);
            } else {
                console.log(`   ✅ Published: ${headline}`);
                
                // 🟢 INTEGRATION: Send to Make.com for Facebook Page 2
                if (process.env.MAKE_WEBHOOK_URL) {
                    const articleUrl = `https://factsport.com/news/${reportSlug}`;
                    await fetch(process.env.MAKE_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fb2_text: `STATEMENT MADE. 🤯 Did your team survive the weekend? Catch up on all the goals, shock results, and table changes in our Matchday Round-Up 👇\n\n${articleUrl}`,
                            x_text: null,
                            x_image_url: null
                        })
                    });
                    console.log(`   📡 Sent ${leagueName} Roundup to FB Page 2 via Make.com`);
                }
            }

        } catch (e) {
            console.error(`   🔥 Gemini Error: ${e.message}`);
        }
    }
}

generateDailySummaries();