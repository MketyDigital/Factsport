const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_NEWS_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys."); 
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

async function generateDailySummaries() {
    console.log("🌙 Starting Daily Matchday Analysis...");

    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const events = config.events || {};

    const tgGeneralChannels = creds.tg_general_channels || [];

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

    let matchSummaries = "";
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        // SURGERY: Removed ### Markdown from the league header here
        matchSummaries += `\n${leagueName.toUpperCase()}:\n`;
        leagueMatches.forEach(m => {
            matchSummaries += `- ${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team} | EXACT SHORTCODE TO USE: [MATCH_WIDGET:${m.id}]\n`;
        });
    }

    const prompt = `
        You are a top-tier European football journalist writing for 'FactSport'.
        Write a deep, engaging "Daily Matchday Round-Up" article covering ALL the leagues and results listed below. 
        Use clear, simple capitalized text for league sections.
        
        TODAY'S EXACT DATE: ${exactDateString}
        
        Results to discuss:
        ${matchSummaries}

        STRICT FACTUAL GUIDELINES:
        1. ZERO HALLUCINATIONS: Do NOT invent or name any specific goalscorers, players, or managers. Focus entirely on the team performance, the final scoreline, and the tactical battle.
        2. EMBEDDING MATCHES: When you finish discussing a match result, you MUST paste its "EXACT SHORTCODE TO USE" on a brand new line all by itself. DO NOT add punctuation, bolding, or extra words to the shortcode. Just the raw code.
        3. Headline: Create a professional, human-sounding football headline (style like Sky Sports or BBC Sport). Captivating but grounded. Under 10 words. Do NOT use #, * or any Markdown symbols.
        4. Length: 500-800 words. Plain text only. Absolutely NO Markdown symbols like #, ##, or ### for headers.
        5. FACEBOOK SUMMARY: At the very end, skip a line and write the exact text "FB_POST:" followed by a comprehensive Facebook post. You MUST mention ALL the major results and scorelines across every league provided. 
        6. NO EMOJIS: Do NOT use a single emoji anywhere in the article or the Facebook post. Keep it entirely text-based and professional.
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

        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        const { error } = await supabase.from('news').insert([{
            title: headline, slug: reportSlug, body: body,
            category: 'Football', image_url: null, 
            team_1_logo: featureMatch ? featureMatch.home_logo : null, 
            team_2_logo: featureMatch ? featureMatch.away_logo : null,
            is_breaking: false, is_headline: false  
        }]);

        if (error) {
            console.error(`   ❌ Supabase DB Error:`, error.message);
        } else {
            console.log(`   ✅ Published: ${headline}`);
            const articleUrl = `https://factsport.com/news/${reportSlug}`;

            try {
                fetch('https://factsport.com/api/index-url', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` },
                    body: JSON.stringify({ url: articleUrl, type: 'URL_UPDATED' })
                }).catch(()=>{});
            } catch (e) {}

            // ====================================================================================
            // 🟢 MULTI-ACCOUNT SOCIAL POSTING BLOCK
            // ====================================================================================
            const summaryConfig = events.daily_summary || {};
            
            const fbText = `${generatedFbText}\n\n👇 Full stats and analysis here:\n${articleUrl} 🏆`;
            const xText = `🌙 MATCHDAY ROUND-UP\n\n${headline}\n\n👇 Full stats & analysis here:\n${articleUrl} 🏆`;

            // 1. MAKE 1
            if (summaryConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
                await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null })
                }).catch(()=>{});
            }

            // 2. MAKE 2
            if (summaryConfig.make2 && creds.make_webhook_2) {
                await fetch(creds.make_webhook_2, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null })
                }).catch(()=>{});
            }

            // 3. FB 1 (Direct API)
            if (summaryConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
                const pageId = creds.fb1_id || process.env.FB_PAGE_ID;
                const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
                await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fbText)}&access_token=${token}`, { method: 'POST' }).catch(()=>{});
            }

            // 4. FB 2 (Direct API)
            if (summaryConfig.fb2 && creds.fb2_id && creds.fb2_token) {
                await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fbText)}&access_token=${creds.fb2_token}`, { method: 'POST' }).catch(()=>{});
            }

            // 5. TG GENERAL (Checking Checkboxes)
            if (summaryConfig.tg_general && creds.telegram_bot_token && tgGeneralChannels.length > 0) {
                for (const channel of tgGeneralChannels) {
                    if (channel.wants_summary !== false) { 
                        const tgMessage = `🌙 <b>MATCHDAY ROUND-UP</b>\n\n<b>${headline}</b>\n\n${generatedFbText}\n\n👇 <b>Full stats and analysis here:</b>\n${articleUrl} 🏆`;
                        await postToTelegram(creds.telegram_bot_token, channel.chatId, tgMessage);
                        console.log(`   ✅ Posted Summary to TG Channel: ${channel.chatId}`);
                        await delay(1500); 
                    }
                }
            }
        }
    } catch (e) { 
        console.error(`   🔥 Gemini Error: ${e.message}`);
    }
}

generateDailySummaries();