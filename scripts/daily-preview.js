// scripts/daily-preview.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const SPORTSDB_KEY = '3'; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 🖼️ Helper
async function getHeroImage(teamName) {
    try {
        const url = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.teams && data.teams[0]) {
            return data.teams[0].strStadiumThumb || data.teams[0].strTeamFanart1 || data.teams[0].strTeamBadge;
        }
    } catch (e) { console.error(e); }
    return null; 
}

async function generateDailyPreview() {
    console.log("☀️ Starting Daily Preview...");

    const today = new Date();
    const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
    const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();
    const dateSlug = today.toISOString().split('T')[0];

    // 1. Fetch Scheduled Matches for TODAY
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
    let mainEvent = matches[0]; 

    for (const [league, games] of Object.entries(leagues)) {
        briefingData += `\n${league}:\n`;
        games.forEach(g => {
            const time = new Date(g.match_date).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time}\n`;
            if (['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona'].some(t => g.home_team.includes(t) || g.away_team.includes(t))) {
                mainEvent = g;
            }
        });
    }

    let heroImage = await getHeroImage(mainEvent.home_team);
    if (!heroImage) heroImage = mainEvent.home_logo;

    const prompt = `
        You are a football editor for 'FactSport'.
        Write a "Daily Briefing" article previewing today's football action (${dateSlug}).
        
        Schedule:
        ${briefingData}

        Guidelines:
        - Headline: Hype up the biggest game.
        - Intro: "Welcome to today's matchday..."
        - Must Watch: Pick 1-2 key games and preview them.
        - Tone: Exciting, anticipatory.
        - Length: 300 words.
        - Output: Plain text.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/"/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        await supabase.from('news').insert({
            title: headline,
            slug: reportSlug,
            body: body,
            image_url: heroImage, 
            source_name: 'FactSport Morning Brief',
            published_at: new Date().toISOString(),
            is_breaking: false, // Normal news
            is_headline: true // Put in slider
        });

        console.log(`   ✅ Published Preview: ${headline}`);

    } catch (e) {
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailyPreview();