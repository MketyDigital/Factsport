// @ts-nocheck
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

async function postToBufferDirectly(text, safeImgUrl, profileId, token) { 
    if (!profileId || !token) return;
    
    const payload = {
        query: "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }",
        variables: {
            input: {
                text: text || "",
                channelId: profileId,
                schedulingType: "automatic",
                mode: "shareNow",
                assets: safeImgUrl && safeImgUrl.length > 5 ? [ { image: { url: safeImgUrl } } ] : []
            }
        }
    };

    try { 
        await fetch("https://api.buffer.com/1/graphql", { 
            method: "POST", 
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}` 
            }, 
            body: JSON.stringify(payload) 
        }); 
    } catch (e) {
        console.error("Buffer Direct Post Failed:", e.message);
    }
}

async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') { 
    if (!botToken || !chatId) return;
    try { await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: false }) }); } catch (e) {}
}

const STANDINGS_CACHE = {};
async function getTableOrStageStanding(leagueCode) {
    if (STANDINGS_CACHE[leagueCode]) return STANDINGS_CACHE[leagueCode];
    const { data: dbStandings, error } = await supabase.from('standings').select('position, team_short_name, team_name, points, stage, group_name').eq('league_code', leagueCode).order('position', { ascending: true });
    if (!error && dbStandings && dbStandings.length > 0) {
        return dbStandings.map(t => {
            const groupText = t.group_name ? `(${t.group_name}) ` : '';
            const stageText = t.stage ? `[${t.stage}] ` : '';
            return `${t.position}. ${stageText}${groupText}${t.team_short_name || t.team_name} - ${t.points}pts`;
        }).join(' | ');
    }
    return null;
}

async function generateDailySummaries() {
    console.log("🌙 Starting Hardcoded Daily Matchday Analysis...");

    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const events = config.events || {};
    const tgGeneralChannels = creds.tg_general_channels || [];

    const now = new Date();
    if (now.getUTCHours() < 6) now.setUTCDate(now.getUTCDate() - 1);

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
    
    const exactDateString = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentMonthYear = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const dateSlug = now.toISOString().split('T')[0];

    const { data: matches } = await supabase.from('matches').select('*').in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']).gte('match_date', startOfDay).lte('match_date', endOfDay);

    if (!matches || matches.length === 0) { console.log(" 💤 No finished matches found for this date."); return; }

    const reportSlug = `matchday-roundup-${dateSlug}`;
    const { data: existing } = await supabase.from('news').select('id').eq('slug', reportSlug).single();
    if (existing) { console.log(` ⏩ Daily Round-Up already published for ${dateSlug}.`); return; }

    const leagues = {};
    matches.forEach(m => {
        if (!leagues[m.league]) leagues[m.league] = [];
        leagues[m.league].push(m);
    });

    let factualDataPayload = "";
    for (const [leagueName, leagueMatches] of Object.entries(leagues)) {
        factualDataPayload += `\nCOMPETITION: ${leagueName.toUpperCase()}\n`;
        
        // Intelligent standings/group/stage context extraction for this league
        let firstMatch = leagueMatches[0];
        let extraStageContext = "";
        if (firstMatch && firstMatch.league_code) {
            const table = await getTableOrStageStanding(firstMatch.league_code);
            if (table) extraStageContext = `\nCurrent Groups/Tables: ${table}\n`;
        }
        factualDataPayload += extraStageContext;
        
        leagueMatches.forEach(m => {
            const isCupTie = ['Champions League', 'Europa League', 'FA Cup', 'World Cup', 'Euros', 'Copa America'].includes(m.league);
            const isFinal = m.match_type?.toLowerCase().includes('final');
            const isKnockout = m.match_type?.toLowerCase().includes('knockout') || m.match_type?.toLowerCase().includes('round of') || m.match_type?.toLowerCase().includes('quarter') || m.match_type?.toLowerCase().includes('semi');
            
            let venueProfile = isCupTie ? `Tournament Venue Setting` : `Domestic League Home Ground`;
            if (isFinal) venueProfile = 'CUP FINAL MATCH - The winner lifts the trophy here.';
            else if (isKnockout) venueProfile = 'KNOCKOUT TIE - The winner advances to the next stage, loser goes home.';

            let scoreLine = `${m.home_team} ${m.home_score} - ${m.away_score} ${m.away_team}`;
            if (m.status === 'PEN' && m.stats?.home_penalties !== null) {
                scoreLine += ` (${m.stats.home_penalties}-${m.stats.away_penalties} on penalties)`;
            }

            const trueEvents = Array.isArray(m.match_events) 
                ? m.match_events.filter(e => e.type === 'goal' || e.type === 'red-card').map(e => `[${e.time}] ${e.text}: ${e.player}`).join('; ')
                : "No major event details logged.";

            factualDataPayload += `MATCH ID: ${m.id}\n- Core Score: ${scoreLine}\n- Ground Setting: ${venueProfile}\n- Final Result Context: ${isFinal ? (m.home_score > m.away_score ? m.home_team + " wins the Cup!" : m.away_score > m.home_score ? m.away_team + " wins the Cup!" : "Cup decided on pens") : (isKnockout ? "Winner advances to next round" : "Standard tie")}\n- Logged Key Events: ${trueEvents}\n- EXACT SHORTCODE TO USE: [MATCH_WIDGET:${m.id}]\n\n`;
        });
    }

    const prompt = `
        You are a gritty, veteran European football pundit writing for 'FactSport'.
        Write a direct, professional, completely factual "Daily Matchday Round-Up" article.
        
        TODAY'S EXACT DATE: ${exactDateString} (Current reality is ${currentMonthYear}).
        
        CRITICAL DATA ENVELOPE (THIS IS YOUR ONLY SOURCE OF TRUTH. SEARCHING IS DISABLED):
        ${factualDataPayload}

        STRICT RULES TO PREVENT ALL HALLUCINATIONS:
        1. ZERO GUESSING ALLOWED: Write *only* about the matches, scores, scorers, and times provided above. If an event or goalscorer is not explicitly listed in the data payload, do not invent one. Focus your commentary entirely on the tactical impact of the final result.
        2. SMART TOURNAMENT INTELLIGENCE: Pay very close attention to the "Ground Setting" and "Final Result Context". 
            - If it says "CUP FINAL MATCH", you MUST explicitly state that the winner has won the trophy/cup.
            - If it says "KNOCKOUT TIE", you MUST explicitly state that the winning team has advanced and knockouts are ruthless.
            - If "Current Groups/Tables" is provided, comment on who qualified, who topped the group, or who is accumulating points aggressively.
        3. HUMAN HEADLINE RULES: Create a 100% human-like, authentic, realistic journalistic headline under 10 words. Read like a premium broadsheet editor. NO colons. NO puns. NO markdown symbols. 
        4. ANTI-AI FILLER: Avoid repetitive filler like "Furthermore", "Delve into", "Tapestry", or "In conclusion". Write punchy, human-like news.
        5. EMBEDDING MATCHES: When you finish discussing a match result, paste its "EXACT SHORTCODE TO USE" on a brand new line all by itself.
        6. LENGTH: 400-700 words. Plain text markdown format. 
        7. FB_POST: At the very end, skip a line and write "FB_POST:" followed by a professional Facebook summary tracking major scores. No emojis.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const text = (await result.response).text();

        const splitText = text.split('FB_POST:');
        const articleContent = splitText[0].trim();
        const generatedFbText = splitText.length > 1 ? splitText[1].trim() : "🏁 FULL TIME! Absolute drama on the pitch today. Tap the link for our complete Round-Up! 👇";

        const lines = articleContent.split('\n').filter(line => line.trim() !== '');
        const headline = lines[0].replace(/^#+\s*/, '').replace(/[\*"]/g, ''); 
        const body = lines.slice(1).join('\n').trim();

        const giants = ['Arsenal','Chelsea','Liverpool','Man City','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG', 'Aston Villa'];
        let featureMatch = matches.find(g => giants.some(t => g.home_team.includes(t) || g.away_team.includes(t))) || matches[0];

        const { error } = await supabase.from('news').insert([{
            title: headline, slug: reportSlug, body: body, category: 'Football', image_url: null, 
            team_1_logo: featureMatch ? featureMatch.home_logo : null, team_2_logo: featureMatch ? featureMatch.away_logo : null,
            is_breaking: false, is_headline: false  
        }]);

        if (error) { console.error(` ❌ Supabase DB Error:`, error.message); return; }
        
        console.log(` ✅ Published Summary: ${headline}`);
        const articleUrl = `https://factsport.com/news/${reportSlug}`;

        try { fetch('https://factsport.com/api/index-url', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_KEY}` }, body: JSON.stringify({ url: articleUrl, type: 'URL_UPDATED' }) }).catch(()=>{}); } catch (e) {}

        const summaryConfig = events.daily_summary || {};
        const fbText = `${generatedFbText}\n\n👇 Full stats and analysis here:\n${articleUrl} 🏆`;
        const xText = `🌙 MATCHDAY ROUND-UP\n\n${headline}\n\n👇 Full stats & analysis here:\n${articleUrl} 🏆`;
        const bufferToken = creds.buffer_token || process.env.BUFFER_ACCESS_TOKEN;

        if (summaryConfig.buf_x1) await postToBufferDirectly(xText, null, creds.buffer_x1_id, bufferToken);
        if (summaryConfig.buf_x2) await postToBufferDirectly(xText, null, creds.buffer_x2_id, bufferToken);
        if (summaryConfig.buf_fb1) await postToBufferDirectly(fbText, null, creds.buffer_fb1_id, bufferToken);
        if (summaryConfig.buf_fb2) await postToBufferDirectly(fbText, null, creds.buffer_fb2_id, bufferToken);

        if (summaryConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) { await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null }) }).catch(()=>{}); }
        if (summaryConfig.make2 && creds.make_webhook_2) { await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fbText, x_text: xText, x_image_url: null }) }).catch(()=>{}); }
        
        if (summaryConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) { const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN; await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fbText)}&access_token=${token}`, { method: 'POST' }).then(async r => { if(!r.ok) console.error("FB1 Error:", await r.text()); }).catch(()=>{}); }
        if (summaryConfig.fb2 && creds.fb2_id && creds.fb2_token) { await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fbText)}&access_token=${creds.fb2_token}`, { method: 'POST' }).then(async r => { if(!r.ok) console.error("FB2 Error:", await r.text()); }).catch(()=>{}); }

        if (summaryConfig.tg_general && creds.telegram_bot_token && tgGeneralChannels.length > 0) {
            for (const channel of tgGeneralChannels) {
                if (channel.wants_summary !== false) { 
                    const tgMessage = `🌙 <b>MATCHDAY ROUND-UP</b>\n\n<b>${headline}</b>\n\n${generatedFbText}\n\n👇 <b>Full stats and analysis here:</b>\n${articleUrl} 🏆`;
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, tgMessage);
                    await delay(1000); 
                }
            }
        }
    } catch (e) { console.error(` 🔥 Gemini Error: ${e.message}`); }
}

generateDailySummaries();
