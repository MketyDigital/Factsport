const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

    const now = new Date();
    if (now.getUTCHours() < 6) {
        now.setUTCDate(now.getUTCDate() - 1);
    }

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
    
    const exactDateString = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateSlug = now.toISOString().split('T')[0];

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
            const scorers = (m.match_events || []).filter(e => e.type === 'goal').map(e => `${e.player} (${e.time})`).join(', ');
            return `- MATCH ID: ${m.id} | ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} (Scorers: ${scorers || 'None'})`;
        }).join('\n');

        // 🛡️ THE IRONCLAD ROUNDUP PROMPT
        const prompt = `
            You are a top-tier European football journalist and master tactical analyst writing for 'FactSport'.
            Write a deep, engaging "Matchday Round-Up" article for the ${leagueName}.
            
            TODAY'S EXACT DATE: ${exactDateString}
            
            Results & Verified Scorers:
            ${matchSummaries}

            STRICT FACTUAL GUIDELINES (CRITICAL TO YOUR INSTRUCTIONS):
            1. APPROVED NAMES ONLY: You may ONLY mention the specific players listed in the "Scorers" data above. 
            2. ZERO HALLUCINATIONS: Do not guess, assume, or name any other players, current managers, or goalkeepers. If a player is not in the data above, they do not exist in this article.
            3. THE NARRATIVE: Focus your analysis on the club philosophies, the shock value of the final scores, and what the results mean for the clubs' momentum.
            4. Headline: Catchy and dramatic, capturing the biggest storyline. Under 10 words. Do not use asterisks (*).
            5. Length: 400-500 words. Plain text only.
            6. CRITICAL LINKING RULE: You MUST wrap EVERY match you mention in a Markdown link pointing to its Match ID. Format strictly as: [View Match Stats](/match/INSERT_MATCH_ID_HERE). Do this for every single game!
        `;

        try {
            const result = await model.generateContent(prompt);
            const text = (await result.response).text();

            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
            const body = lines.slice(1).join('\n').trim();

            let featureMatch = leagueMatches[0];

            const { error } = await supabase.from('news').insert([{
                title: headline, slug: reportSlug, body: body,
                image_url: null, team_1_logo: featureMatch ? featureMatch.home_logo : null, 
                team_2_logo: featureMatch ? featureMatch.away_logo : null,
                is_breaking: false, is_headline: false  
            }]);

            if (error) console.error(`   ❌ Supabase DB Error:`, error.message);
            else {
                console.log(`   ✅ Published: ${headline}`);
                if (process.env.MAKE_WEBHOOK_URL) {
                    const articleUrl = `https://factsport.com/news/${reportSlug}`;
                    await fetch(process.env.MAKE_WEBHOOK_URL, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fb2_text: `STATEMENT MADE. 🤯 Did your team survive the weekend? Catch up on all the goals, shock results, and table changes in our Matchday Round-Up 👇\n\n${articleUrl} 🏆`,
                            x_text: null, x_image_url: null
                        })
                    });
                }
            }
        } catch (e) {
            console.error(`   🔥 Gemini Error: ${e.message}`);
        }
    }
}

generateDailySummaries();