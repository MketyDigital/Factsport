const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_NEWS_KEY; 
const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys. Make sure SUPABASE, GEMINI, and FOOTBALL_DATA keys are set."); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ESPN_LEAGUES = { 'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Bundesliga': 'ger.1', 'Serie A': 'ita.1', 'Ligue 1': 'fra.1', 'Champions League': 'uefa.champions', 'Europa League': 'uefa.europa', 'FA Cup': 'eng.fa' };
const FD_LEAGUES = { 'Premier League': 'PL', 'La Liga': 'PD', 'Bundesliga': 'BL1', 'Serie A': 'SA', 'Ligue 1': 'FL1', 'Champions League': 'CL' };

const getCanonicalName = (rawName) => {
    if (!rawName) return "";
    return rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '')
        .replace(/\b(1|fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|olympique|de|united|city|hotspur|albion|wanderers|villa)\b/g, '')
        .replace(/\s+/g, ' ').trim();
};

const isStrongMatch = (dbName, apiName) => {
    const s1 = getCanonicalName(dbName); const s2 = getCanonicalName(apiName);
    if (s1.length < 3 || s2.length < 3) return s1 === s2;
    return s1.includes(s2) || s2.includes(s1);
};

// 🟢 HYBRID STANDINGS CACHE
const standingsCache = {};

async function getLeagueStandings(leagueName) {
    const mappedLeague = FD_LEAGUES[leagueName];
    if (!mappedLeague) return "Standings unavailable.";
    
    if (standingsCache[mappedLeague]) return standingsCache[mappedLeague];

    const domesticLeagues = ['PL', 'PD', 'BL1', 'SA', 'FL1']; 
    if (!domesticLeagues.includes(mappedLeague)) return "Tournament/Cup tie - League table not applicable. Focus strictly on knockout stakes, recent form, and H2H.";

    try {
        if (FD_API_KEY) {
            const liveRes = await fetch(`https://api.football-data.org/v4/competitions/${mappedLeague}/standings`, { headers: { 'X-Auth-Token': FD_API_KEY } });
            if (liveRes.ok) {
                const data = await liveRes.json();
                if (data.standings && data.standings[0]) {
                    const resultStr = `FULL LEAGUE TABLE: ` + data.standings[0].table.map(t => `${t.position}. ${t.team.shortName} (${t.points}pts)`).join(', ');
                    standingsCache[mappedLeague] = resultStr; 
                    return resultStr;
                }
            }
        }
    } catch (e) { console.log(`⚠️ Live API failed for ${leagueName}, falling back to DB cache...`); }

    try {
        const { data: dbStandings, error } = await supabase.from('standings').select('position, team_short_name, team_name, points').eq('league_code', mappedLeague).order('position', { ascending: true });
        if (!error && dbStandings && dbStandings.length > 0) {
            const resultStr = `FULL LEAGUE TABLE: ` + dbStandings.map(t => `${t.position}. ${t.team_short_name || t.team_name} (${t.points}pts)`).join(', ');
            standingsCache[mappedLeague] = resultStr; 
            return resultStr;
        }
    } catch (e) {} 
    
    return "Standings unavailable.";
}

async function getMatchContext(leagueName, dateString, homeTeam, awayTeam) {
    let contextStr = "";
    const espnCode = ESPN_LEAGUES[leagueName];
    let espnSuccess = false;

    if (espnCode) {
        const matchDate = new Date(dateString);
        const datesToTry = [ matchDate.toISOString().split('T')[0].replace(/-/g, ''), new Date(matchDate.getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, ''), new Date(matchDate.getTime() - 86400000).toISOString().split('T')[0].replace(/-/g, '') ];
        
        for (const dp of datesToTry) {
            try {
                const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${dp}`);
                if (!res.ok) continue;
                const data = await res.json();
                if (!data.events) continue;
                
                const event = data.events.find(e => {
                    const h = e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
                    const a = e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName;
                    return isStrongMatch(homeTeam, h) && isStrongMatch(awayTeam, a);
                });

                if (event) {
                    const sumRes = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${event.id}`);
                    const sData = await sumRes.json();
                    
                    if (sData.form && sData.form.length >= 2) {
                        contextStr += `[FORM] ${sData.form[0].team.displayName}: ${sData.form[0].events.map(e=>e.teamResult).join('')} | ${sData.form[1].team.displayName}: ${sData.form[1].events.map(e=>e.teamResult).join('')} `;
                    }
                    if (sData.headToHead?.games?.length > 0) {
                        contextStr += `| [H2H] ${sData.headToHead.games.slice(0, 3).map(g => `${g.homeTeam.abbrev} ${g.homeTeam.score}-${g.awayTeam.score} ${g.awayTeam.abbrev}`).join(', ')}`;
                    }
                    espnSuccess = true; break;
                }
            } catch (e) {}
        }
    }

    if (!espnSuccess && FD_API_KEY && FD_LEAGUES[leagueName]) {
        try {
            const res = await fetch(`https://api.football-data.org/v4/competitions/${FD_LEAGUES[leagueName]}/matches?status=FINISHED`, { headers: { 'X-Auth-Token': FD_API_KEY } });
            const data = await res.json();
            if (data.matches) {
                const homeForm = data.matches.filter(m => isStrongMatch(m.homeTeam.name, homeTeam) || isStrongMatch(m.awayTeam.name, homeTeam)).slice(-3).map(m => `${m.homeTeam.shortName} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.shortName}`).join(', ');
                contextStr = `[RECENT RESULTS FALLBACK] ${homeTeam}: ${homeForm || 'N/A'}`;
            }
        } catch(e) {}
    }
    return contextStr || "[NO H2H/FORM FOUND - Base analysis on general team strength]";
}

async function postToBufferDirectly(text, safeImgUrl, profileId, token) { 
    if (!profileId || !token) return;
    const hasImg = safeImgUrl && safeImgUrl.length > 5;
    const query = hasImg ? `mutation($text: String!, $img: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow, assets: { images: [{ url: $img }] } }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }` : `mutation($text: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`;
    const variables = hasImg ? { text: text || "", img: safeImgUrl } : { text: text || "" };
    try { await fetch("https://api.buffer.com/1/graphql", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ query, variables }) }); } catch (e) {}
}

async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') { 
    if (!botToken || !chatId) return;
    try { await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: false }) }); } catch (e) {}
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
        const tableStr = await getLeagueStandings(league);
        briefingData += `\n${league.toUpperCase()} CONTEXT:\n${tableStr}\n\nFIXTURES TODAY:\n`;
        
        for (const g of games) {
            const time = new Date(g.match_date).toLocaleTimeString('en-GB', {timeZone: 'UTC', hour: '2-digit', minute:'2-digit'});
            const h2hStr = await getMatchContext(g.league, g.match_date, g.home_team, g.away_team);
            briefingData += `- ${g.home_team} vs ${g.away_team} at ${time} GMT.\n  STATS CHEAT SHEET: ${h2hStr}\n  EXACT SHORTCODE TO USE: [MATCH_WIDGET:${g.id}]\n\n`;
        }
    }

    const prompt = `
        You are a gritty, highly experienced European football pundit writing for 'FactSport'. 
        You speak plainly, directly, and from a place of deep tactical knowledge. 
        Write a hard-hitting "Daily Briefing" article previewing today's football action.
        
        TODAY'S EXACT DATE: ${exactDateString} (Current reality is ${currentMonthYear}).
        
        FACTUAL CONTEXT (THIS IS YOUR ONLY SOURCE OF TRUTH):
        ${briefingData}

        STRICT RULES:
        1. USE THE CHEAT SHEET: You MUST base your analysis of each team's form, motivation, and standing purely on the "CONTEXT" and "STATS CHEAT SHEET" provided above. Do not invent past results. 
        2. TONE & FAIL-SAFE: Punchy, direct, and authoritative. NEVER apologize for lack of data. NEVER say "Information is limited." If the cheat sheet is sparse, lean entirely on your expert knowledge of these clubs' historical pedigree and general playstyles.
        3. NO BANNED WORDS: Never use "Moreover", "Furthermore", "Delve into", "Tapestry", or "A thrilling encounter".
        4. HUMAN HEADLINE: Create a 100% realistic, gritty journalistic headline under 10 words. NO colons. NO puns. NO markdown symbols. Do not use generic words like "Showdown" or "Clash". 
           - BAD: "A Thrilling Encounter: Arsenal Face Chelsea in London Derby"
           - GOOD: "Arsenal face ultimate title test as Chelsea visit Emirates"
        5. SEARCH TOOL FALLBACK: Only use Google Search if you need to check for a major, breaking injury that happened TODAY.
        6. EMBEDDING MATCHES: After you finish analyzing a match, paste its "EXACT SHORTCODE TO USE" on a brand new line all by itself.
        7. FB_POST: At the very end, skip a line and write "FB_POST:" followed by a Facebook summary of today's slate.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], tools: [{ googleSearch: {} }] });
        const text = (await result.response).text();

        const splitText = text.split('FB_POST:');
        const articleContent = splitText[0].trim();
        const generatedFbText = splitText.length > 1 ? splitText[1].trim() : "🚨 MATCHDAY IS HERE! Massive stakes across Europe today. Drop your predictions below! 👇";

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
                    await delay(1000); 
                }
            }
        }
    } catch (e) { console.error(`   🔥 Gemini Error: ${e.message}`); }
}

generateDailyPreview();