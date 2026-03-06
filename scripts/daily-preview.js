const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Config
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

    const today = new Date();
    const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
    const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();
    const dateSlug = today.toISOString().split('T')[0];

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

    let briefingData = "";

    for (const [league, games] of Object.entries(leagues)) {
        briefingData += `\n${league}:\n`;
        games.forEach(g => {
            const time = new Date(g.match_date).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
            briefingData += `- MATCH ID: ${g.id} | ${g.home_team} vs ${g.away_team} at ${time}\n`;
        });
    }

    // 🟢 AI UPGRADE: Expert Tactical Preview
    const prompt = `
        You are a top-tier European football journalist and master tactical analyst writing for 'FactSport'.
        Write a deep, engaging "Daily Briefing" article previewing today's football action (${dateSlug}).
        
        Schedule:
        ${briefingData}

        Guidelines:
        - Headline: Punchy and narrative-driven (e.g., "The Midfield Battle That Could Define the Title Race"). Under 10 words.
        - Intro: Hook the reader immediately. Set the stakes for the day and ask provocative questions (e.g., "Who will drop vital points today?").
        - Tactical Analysis: Pick the 2-3 biggest matches. Don't just list the times—analyze the tactical matchups, key player battles, and what a win or loss means for the managers. Write like a passionate human expert.
        - Tone: Insightful, opinionated, and highly engaging.
        - Length: 400-500 words.
        - Output: Plain text only. Do not use asterisks for bolding.
        - CRITICAL LINKING RULE: You MUST wrap EVERY match you mention in a Markdown link pointing to its Match ID. 
          Format strictly as: [Arsenal vs Chelsea](/match/INSERT_MATCH_ID_HERE). Do this for every single game you discuss!
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

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
            console.log(`   ✅ Published Preview: ${headline}`);
            
            // 🟢 INTEGRATION: Send to Make.com for Facebook Page 2
            if (process.env.MAKE_WEBHOOK_URL) {
                const articleUrl = `https://factsport.com/news/${reportSlug}`;
                await fetch(process.env.MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: `Who drops points today? 🧐 Read our full tactical breakdown of today's biggest clashes and predictions 👇\n\n${articleUrl}`,
                        x_text: null,
                        x_image_url: null
                    })
                });
                console.log("   📡 Sent AI Preview to FB Page 2 via Make.com");
            }
        }

    } catch (e) {
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailyPreview();