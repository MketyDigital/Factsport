const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

async function generateDailyPreview() {
    console.log("☀️ Starting Daily Preview...");

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
    
    const exactDateString = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateSlug = now.toISOString().split('T')[0];

    const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .neq('status', 'FT') 
        .gte('match_date', startOfDay)
        .lte('match_date', endOfDay);

    if (!matches || matches.length === 0) {
        console.log("   💤 No matches scheduled today.");
        return;
    }

    const reportSlug = `daily-briefing-${dateSlug}`;
    const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
    if (existing) { console.log("   ⏩ Preview already published."); return; }

    const leagues = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    // 🟢 PRE-BUILT EXACT LINKS
    let briefingData = "";
    for (const [league, games] of Object.entries(leagues)) {
        briefingData += `\n${league}:\n`;
        games.forEach(g => {
            const time = new Date(g.match_date).toLocaleTimeString('en-GB', {timeZone: 'UTC', hour: '2-digit', minute:'2-digit'});
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time} GMT | EXACT LINK TO USE: [Match Center](/match/${g.id})\n`;
        });
    }

    const prompt = `
        You are a top-tier European football journalist writing for 'FactSport'.
        Write a deep, engaging "Daily Briefing" article previewing today's football action.
        
        TODAY'S EXACT DATE: ${exactDateString}
        
        Schedule:
        ${briefingData}

        STRICT FACTUAL GUIDELINES:
        1. TIME AWARENESS: It is currently 2026. 
        2. ZERO HALLUCINATIONS: Do NOT invent or name any specific players or managers. You do not have that data. Focus on the clubs, their current form, and the importance of the fixture.
        3. EXACT MATCH LINKS: When you mention a match, you MUST copy and paste the "EXACT LINK TO USE" provided in the schedule above. Do not try to write the URL yourself.
        4. Headline: Punchy and narrative-driven. Under 10 words. Do not use asterisks (*).
        5. Tone: Insightful, opinionated, and highly engaging. 
        6. Length: 400-500 words. Plain text only.
        7. FACEBOOK SUMMARY: At the very end of your entire response, skip a line and write the exact text "FB_POST:" followed by a short, punchy 2-3 sentence Facebook post summarizing your article. Mention the specific big matches you discussed. Do not use hashtags.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

        const splitText = text.split('FB_POST:');
        const articleContent = splitText[0].trim();
        const generatedFbText = splitText.length > 1 ? splitText[1].trim() : "🚨 MATCHDAY IS HERE! The stakes are massive across Europe today. Who are you backing to secure all 3 points? 🤔 Drop your predictions in the comments and tap below for our full tactical preview! 👇";

        const lines = articleContent.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        const { error } = await supabase.from('news').insert([{
            title: headline, slug: reportSlug, body: body,
            image_url: null, team_1_logo: featureMatch ? featureMatch.home_logo : null, 
            team_2_logo: featureMatch ? featureMatch.away_logo : null,
            is_breaking: false, is_headline: false  
        }]);

        if (error) console.error(`   ❌ Supabase DB Error:`, error.message);
        else {
            console.log(`   ✅ Published Preview: ${headline}`);
            if (process.env.MAKE_WEBHOOK_URL) {
                const articleUrl = `https://factsport.com/news/${reportSlug}`;
                await fetch(process.env.MAKE_WEBHOOK_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: `${generatedFbText}\n\n👇 Read the full breakdown here:\n${articleUrl} 🏆`,
                        x_text: null, x_image_url: null
                    })
                });
            }
        }
    } catch (e) {
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailyPreview();