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
    // 🛡️ DATE-DRIFT CHECK
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

    const leagues = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        if (leagueMatches.length < 1) continue; 

        const reportSlug = `${leagueName.toLowerCase().replace(/\s+/g, '-')}-roundup-${dateSlug}`;
        
        // 🔒 CHECK FOR DUPLICATES
        const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
        if (existing) {
            console.log(`   ⏩ Already reported: ${leagueName}`);
            continue;
        }

        console.log(`   ✍️ Writing Summary for ${leagueName}...`);

        // 🟢 PRE-BUILT EXACT LINKS (Fixes the broken missing letters bug!)
        const matchSummaries = leagueMatches.map(m => {
            return `- ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} | EXACT LINK TO USE: [View Match Stats](/match/${m.id})`;
        }).join('\n');

        const prompt = `
            You are a top-tier European football journalist writing for 'FactSport'.
            Write a deep, engaging "Matchday Round-Up" article for the ${leagueName}.
            
            TODAY'S EXACT DATE: ${exactDateString}
            
            Results to discuss:
            ${matchSummaries}

            STRICT FACTUAL GUIDELINES:
            1. ZERO HALLUCINATIONS: Do NOT invent or name any specific goalscorers, players, or managers. You do not have that data. Focus entirely on the team performance, the final scoreline, and the tactical battle.
            2. EXACT MATCH LINKS: When you mention a match, you MUST copy and paste the "EXACT LINK TO USE" provided in the data above. Do not try to write the URL yourself.
            3. Headline: Catchy and dramatic. Under 10 words. Do not use asterisks (*).
            4. Length: 400-500 words. Plain text only.
            5. FACEBOOK SUMMARY: At the very end, skip a line and write the exact text "FB_POST:" followed by a short, punchy 2-sentence Facebook post. Mention major scorelines and tease the article. Do not use hashtags.
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
            console.error(`   🔥 Gemini Error for ${leagueName}: ${e.message}`);
        }
    }
}

generateDailySummaries();