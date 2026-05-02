const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_NEWS_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys"); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') {
    if (!botToken || !chatId) return;
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: false })
        });
    } catch (e) {
        console.error("❌ Telegram Post Error:", e.message);
    }
}

async function generateDailyPreview() {
    console.log("☀️ Starting Daily Preview...");

    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const events = config.events || {};

    const tgGeneralChannels = creds.tg_general_channels || [];

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
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time} GMT | EXACT SHORTCODE TO USE: [MATCH_WIDGET:${g.id}]\n`;
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
        2. ZERO HALLUCINATIONS: Do NOT invent or name any specific players or managers. Focus on the clubs, their current form, and the importance of the fixture.
        3. EMBEDDING MATCHES: When you finish analyzing a specific match, you MUST paste its "EXACT SHORTCODE TO USE" on a brand new line all by itself. DO NOT add punctuation, bolding, or extra words to the shortcode. Just the raw code.
        4. Headline: Punchy and narrative-driven. Under 10 words. Do not use asterisks (*).
        5. Tone: Insightful, opinionated, and highly engaging. 
        6. Length: 400-600 words. Plain text only.
        7. FACEBOOK SUMMARY: At the very end of your entire response, skip a line and write the exact text "FB_POST:" followed by a comprehensive Facebook post. You MUST mention EVERY specific match listed in the schedule above so fans know exactly what is playing today. Make it highly engaging. 
        8. NO EMOJIS: Do NOT use a single emoji anywhere in the article or the Facebook post. Keep it entirely text-based and professional.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();

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
            const articleUrl = `https://factsport.com/news/${reportSlug}`;

            // PING GOOGLE
            try {
                fetch('https://factsport.com/api/index-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
                    body: JSON.stringify({ url: articleUrl, type: 'URL_UPDATED' })
                }).catch(()=>{});
            } catch (e) {}

            // 🟢 SOCIAL POSTING BLOCK
            const isFbEnabled = events.daily_preview?.fb !== false;
            const isXEnabled = events.daily_preview?.x !== false;
            const isTgEnabled = events.daily_preview?.tg_general !== false;

            const makeUrl = creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL;
            
            if (makeUrl && (isFbEnabled || isXEnabled)) {
                await fetch(makeUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: isFbEnabled ? `${generatedFbText}\n\n👇 Read the full breakdown here:\n${articleUrl} 🏆` : null,
                        x_text: isXEnabled ? `☀️ MATCHDAY PREVIEW\n\n${headline}\n\n👇 Read our tactical breakdown here:\n${articleUrl} 🏆` : null, 
                        x_image_url: null
                    })
                });
            }

            // Loop through all registered Telegram General Channels
            if (isTgEnabled && creds.telegram_bot_token && tgGeneralChannels.length > 0) {
                for (const channel of tgGeneralChannels) {
                    const tgMessage = `☀️ <b>MATCHDAY PREVIEW</b>\n\n<b>${headline}</b>\n\n${generatedFbText}\n\n👇 <b>Read the full tactical breakdown here:</b>\n${articleUrl} 🏆`;
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, tgMessage);
                    console.log(`   ✅ Posted Preview to TG Channel: ${channel.chatId}`);
                    await delay(1500); // Safe delay
                }
            }
        }
    } catch (e) { 
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailyPreview();