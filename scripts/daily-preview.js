const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

    let briefingData = "";
    for (const [league, games] of Object.entries(leagues)) {
        briefingData += `\n${league}:\n`;
        games.forEach(g => {
            const time = new Date(g.match_date).toLocaleTimeString('en-GB', {timeZone: 'UTC', hour: '2-digit', minute:'2-digit'});
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time} GMT | EXACT LINK TO USE: [Match Center](/match/${g.id})\n`;
        });
    }

    const systemPrompt = "You are a top-tier European football journalist writing for 'FactSport'. Write a deep, engaging Daily Briefing article previewing today's football action.";
    const userPrompt = `
        TODAY'S EXACT DATE: ${exactDateString}
        
        Schedule:
        ${briefingData}

        STRICT FACTUAL GUIDELINES:
        1. TIME AWARENESS: It is currently 2026. 
        2. ZERO HALLUCINATIONS: Do NOT invent or name any specific players or managers. Focus on the clubs, their current form, and the importance of the fixture.
        3. EXACT MATCH LINKS: When you mention a match, you MUST copy and paste the "EXACT LINK TO USE" provided in the schedule above. Do not try to write the URL yourself.
        4. Headline: Punchy and narrative-driven. Under 10 words. Do not use asterisks (*).
        5. Tone: Insightful, opinionated, and highly engaging. 
        6. Length: 400-600 words. Plain text only.
        7. FACEBOOK SUMMARY: At the very end of your entire response, skip a line and write the exact text "FB_POST:" followed by a comprehensive, exciting Facebook post. You MUST mention EVERY specific match listed in the schedule above so fans know exactly what is playing today. Make it highly engaging and use emojis. Do not use hashtags.
    `;

    try {
        console.log("   🧠 Calling Groq API (Llama 3.3)...");
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_completion_tokens: 1500
            })
        });

        if (!response.ok) throw new Error(`Groq API Error: ${response.statusText}`);
        const data = await response.json();
        const text = data.choices[0].message.content;

        const splitText = text.split('FB_POST:');
        const articleContent = splitText[0].trim();
        const generatedFbText = splitText.length > 1 ? splitText[1].trim() : "🚨 MATCHDAY IS HERE! Massive stakes across Europe today. Drop your predictions in the comments and tap below for our full tactical preview! 👇";

        const lines = articleContent.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        const { error } = await supabase.from('news').insert([{
            title: headline, slug: reportSlug, body: body,
            category: 'Football',
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
        console.error(`   🔥 Groq Error: ${e.message}`);
    }
}

generateDailyPreview();