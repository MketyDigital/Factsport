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

async function postToBufferDirectly(text, safeImgUrl, profileId, token) {
    if (!profileId || !token) return;
    const hasImg = safeImgUrl && safeImgUrl.length > 5;
    
    const query = hasImg 
        ? `mutation($text: String!, $img: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow, assets: { images: [{ url: $img }] } }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`
        : `mutation($text: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`;
    
    const variables = hasImg ? { text: text || "", img: safeImgUrl } : { text: text || "" };

    try {
        const res = await fetch("https://api.buffer.com/1/graphql", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ query, variables })
        });
        const data = await res.json();
        if (data?.data?.createPost?.message) throw new Error(data.data.createPost.message);
    } catch (e) { console.error(`Buffer Error for ${profileId}:`, e.message); }
}

async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') {
    if (!botToken || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: false })
        });
    } catch (e) { console.error("❌ Telegram Post Error:", e.message); }
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
    const currentMonthYear = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const dateSlug = now.toISOString().split('T')[0];

    const { data: matches } = await supabase.from('matches').select('*').neq('status', 'FT').gte('match_date', startOfDay).lte('match_date', endOfDay);

    if (!matches || matches.length === 0) { console.log("   💤 No matches scheduled today."); return; }

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
        You are an elite, premium European football journalist working exclusively for 'FactSport'.
        Write a deep, engaging, and highly accurate "Daily Briefing" article previewing today's football action.
        
        TODAY'S EXACT DATE: ${exactDateString} (It is CURRENTLY ${currentMonthYear}).
        
        Schedule:
        ${briefingData}

        STRICT FACTUAL & TONAL GUIDELINES (FAILURE IS NOT AN OPTION):
        1. LIVE SEARCH MANDATORY: You MUST use Google Search to look up the CURRENT ${currentMonthYear} league table standings, injuries, and recent form for these teams. 
        2. TIER-1 SOURCES ONLY: When searching, you MUST ONLY trust verified, elite sports journalism (e.g., BBC Sport, Sky Sports, The Athletic, ESPN, Reuters, The Guardian). You must completely IGNORE fan blogs, Reddit, Twitter rumors, or unverified sites. If a rumor isn't on a Tier-1 site, it does not exist.
        3. NO HALLUCINATIONS: Do not mention a team fighting relegation if they are mid-table in ${currentMonthYear}. Only reference current, real-world context verified by Tier-1 sources.
        4. 100% HUMAN & ORIGINAL: Write completely original, copyright-free journalism. Do NOT use clunky AI buzzwords like "Moreover", "Furthermore", "Delve into", "Tapestry", "A thrilling encounter", or "Buckle up". Sound like a real, opinionated human pundit.
        5. EMBEDDING MATCHES: When you finish analyzing a specific match, paste its "EXACT SHORTCODE TO USE" on a brand new line all by itself. DO NOT add punctuation or bolding to the shortcode.
        6. HEADLINE: Create a captivating but grounded headline under 10 words. NO Markdown symbols (#, *).
           - BAD AI HEADLINE: "Premier League Showdown: Arsenal Faces Chelsea in London Derby"
           - GOOD HUMAN HEADLINE: "Arsenal face ultimate title test as Chelsea visit Emirates"
        7. LENGTH: 400-600 words. Plain text only. Use simple capitalized text for headers.
        8. FACEBOOK SUMMARY: At the very end, skip a line and write "FB_POST:" followed by a comprehensive Facebook post mentioning EVERY specific match listed today. No emojis.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }] });
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
            title: headline, slug: reportSlug, body: body, category: 'Football', image_url: null, 
            team_1_logo: featureMatch ? featureMatch.home_logo : null, team_2_logo: featureMatch ? featureMatch.away_logo : null,
            is_breaking: false, is_headline: false  
        }]);

        if (error) { console.error(`   ❌ Supabase DB Error:`, error.message); return; }
        
        console.log(`   ✅ Published Preview: ${headline}`);
        const articleUrl = `https://factsport.com/news/${reportSlug}`;

        try { fetch('https://factsport.com/api/index-url', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` }, body: JSON.stringify({ url: articleUrl, type: 'URL_UPDATED' }) }).catch(()=>{}); } catch (e) {}

        const previewConfig = events.daily_preview || {};
        const fbText = `${generatedFbText}\n\n👇 Read the full breakdown here:\n${articleUrl} 🏆`;
        const xText = `☀️ MATCHDAY PREVIEW\n\n${headline}\n\n👇 Read our tactical breakdown here:\n${articleUrl} 🏆`;
        const bufferToken = creds.buffer_token || process.env.BUFFER_ACCESS_TOKEN;

        // ISOLATED BROADCASTING
        if (previewConfig.buf_x1) await postToBufferDirectly(xText, null, creds.buffer_x1_id, bufferToken);
        if (previewConfig.buf_x2) await postToBufferDirectly(xText, null, creds.buffer_x2_id, bufferToken);
        if (previewConfig.buf_fb1) await postToBufferDirectly(fbText, null, creds.buffer_fb1_id, bufferToken);
        if (previewConfig.buf_fb2) await postToBufferDirectly(fbText, null, creds.buffer_fb2_id, bufferToken);

        if (previewConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) { await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null }) }).catch(()=>{}); }
        if (previewConfig.make2 && creds.make_webhook_2) { await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null }) }).catch(()=>{}); }
        
        if (previewConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) { const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN; await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fbText)}&access_token=${token}`, { method: 'POST' }).catch(()=>{}); }
        if (previewConfig.fb2 && creds.fb2_id && creds.fb2_token) { await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fbText)}&access_token=${creds.fb2_token}`, { method: 'POST' }).catch(()=>{}); }

        if (previewConfig.tg_general && creds.telegram_bot_token && tgGeneralChannels.length > 0) {
            for (const channel of tgGeneralChannels) {
                if (channel.wants_preview !== false) { 
                    const tgMessage = `☀️ <b>MATCHDAY PREVIEW</b>\n\n<b>${headline}</b>\n\n${generatedFbText}\n\n👇 <b>Read the full tactical breakdown here:</b>\n${articleUrl} 🏆`;
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, tgMessage);
                    await delay(1500); 
                }
            }
        }
    } catch (e) { console.error(`   🔥 Gemini Error: ${e.message}`); }
}

generateDailyPreview();