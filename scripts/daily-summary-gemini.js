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
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED'])
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay);

    if (!matches || matches.length === 0) {
        console.log("   💤 No finished matches found for this date.");
        return;
    }

    // 🟢 UPGRADE: Check for the single combined Round-Up article first
    const reportSlug = `matchday-roundup-${dateSlug}`;
    const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
    if (existing) {
        console.log(`   ⏩ Daily Round-Up already published for ${dateSlug}.`);
        return;
    }

    console.log(`   ✍️ Writing Unified Summary for all leagues...`);

    const leagues = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    // 🟢 UPGRADE: Combine all matches into sections
    let matchSummaries = "";
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        matchSummaries += `\n### ${leagueName}:\n`;
        leagueMatches.forEach(m => {
            matchSummaries += `- ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} | EXACT LINK TO USE: [View Match Stats](/match/${m.id})\n`;
        });
    }

    // 🟢 UPGRADED PROMPT: Tells Gemini to combine them into one article
    const prompt = `
        You are a top-tier European football journalist writing for 'FactSport'.
        Write a deep, engaging "Daily Matchday Round-Up" article covering ALL the leagues and results listed below. 
        Use clear headings to separate the analysis for each league/competition.
        
        TODAY'S EXACT DATE: ${exactDateString}
        
        Results to discuss:
        ${matchSummaries}

        STRICT FACTUAL GUIDELINES:
        1. ZERO HALLUCINATIONS: Do NOT invent or name any specific goalscorers, players, or managers. Focus entirely on the team performance, the final scoreline, and the tactical battle.
        2. EXACT MATCH LINKS: When you mention a match, you MUST copy and paste the "EXACT LINK TO USE" provided in the data above. Do not try to write the URL yourself.
        3. Headline: Catchy and dramatic, covering the global day of football. Under 10 words. Do not use asterisks (*).
        4. Length: 500-800 words. Plain text only.
        5. FACEBOOK SUMMARY: At the very end, skip a line and write the exact text "FB_POST:" followed by a comprehensive Facebook post. You MUST mention ALL the major results and scorelines across every league provided. Make it highly engaging, use emojis, and tease the full article. Do not use hashtags.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

        const splitText = text.split('FB_POST:');
        const articleContent = splitText[0].trim();
        const generatedFbText = splitText.length > 1 ? splitText[1].trim() : "🏁 FULL TIME! Absolute drama on the pitch today. 🤯 Tap the link for our complete Round-Up! 👇";

        const lines = articleContent.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        // Pick the most high-profile match of the day to use as the thumbnail
        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        // 🟢 ADDED CATEGORY
        const { error } = await supabase.from('news').insert([{
            title: headline, 
            slug: reportSlug, 
            body: body,
            category: 'Football', // Ensures it displays properly
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
            if (process.env.MAKE_WEBHOOK_URL) {
                const articleUrl = `https://factsport.com/news/${reportSlug}`;
                await fetch(process.env.MAKE_WEBHOOK_URL, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: `${generatedFbText}\n\n👇 Full stats and analysis here:\n${articleUrl} 🏆`,
                        x_text: null, 
                        x_image_url: null
                    })
                });
            }
        }
    } catch (e) {
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailySummaries();