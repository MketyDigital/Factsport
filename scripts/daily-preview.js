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

    // 1. Fetch Scheduled Matches
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

    // 2. Prepare Data
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
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time}\n`;
        });
    }

    const prompt = `
        You are a football editor for 'FactSport'.
        Write a "Daily Briefing" article previewing today's football action (${dateSlug}).
        
        Schedule:
        ${briefingData}

        Guidelines:
        - Headline: Hype up the biggest games. Keep it under 10 words.
        - Intro: "Welcome to today's matchday..."
        - Must Watch: Pick 1-2 key games and preview them.
        - Tone: Exciting, anticipatory.
        - Length: 300 words.
        - Output: Plain text. Do not use asterisks for bolding.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        // 🟢 FIND THE BIGGEST MATCH TO FEATURE ON THE COVER
        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        // 🟢 INSERT NATIVE LOGOS (Pass null for image_url to trigger NewsArtwork VS Mode)
        const { error } = await supabase.from('news').insert([{
            title: headline,
            slug: reportSlug,
            body: body,
            image_url: null, 
            team_1_logo: featureMatch ? featureMatch.home_logo : null, 
            team_2_logo: featureMatch ? featureMatch.away_logo : null,
            is_breaking: false, 
            is_headline: true 
        }]);

        if (error) {
            console.error(`   ❌ Supabase DB Error:`, error.message);
            console.error(`   Details:`, error.details || error.hint);
        } else {
            console.log(`   ✅ Published Preview: ${headline}`);
        }

    } catch (e) {
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailyPreview();