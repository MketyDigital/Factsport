// @ts-nocheck
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) { 
    console.error("❌ Missing Keys. Make sure SUPABASE, GEMINI, and FOOTBALL_DATA keys are set."); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const proSlipSchema = {
    type: SchemaType.OBJECT,
    properties: {
        primary: { type: SchemaType.STRING, description: "e.g., Over 2.5 Goals" },
        odds: { type: SchemaType.STRING, description: "e.g., 1.60" },
        safe: { type: SchemaType.STRING, description: "e.g., Home Win or Draw" },
        safeOdds: { type: SchemaType.STRING, description: "e.g., 1.20" },
        rationale: { type: SchemaType.STRING, description: "40-50 words of expert tactical rationale." }
    },
    required: ["primary", "odds", "safe", "safeOdds", "rationale"]
};

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: proSlipSchema }
}); 

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🟢 HTML SANITIZER: Prevents Telegram from crashing if the AI uses < or > symbols
const escapeHTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    let contextStr = ""; let translatedH2H = null;
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
                        let hw = 0, aw = 0, d = 0, tg = 0; let mapped = [];
                        const h2hStr = sData.headToHead.games.slice(0, 4).map(g => {
                            const hs = parseInt(g.homeTeam.score); const as = parseInt(g.awayTeam.score); tg += (hs + as);
                            const isHistHome = isStrongMatch(homeTeam, g.homeTeam.displayName);
                            if (hs === as) d++; else if (hs > as) isHistHome ? hw++ : aw++; else isHistHome ? aw++ : hw++;
                            mapped.push({ utcDate: g.date, homeTeam: { name: g.homeTeam.displayName }, awayTeam: { name: g.awayTeam.displayName }, score: { fullTime: { home: hs, away: as } } });
                            return `${g.homeTeam.abbrev} ${hs}-${as} ${g.awayTeam.abbrev}`;
                        }).join(', ');
                        contextStr += `| [H2H] ${h2hStr}`;
                        translatedH2H = { aggregates: { numberOfMatches: sData.headToHead.games.length, totalGoals: tg, homeTeam: { wins: hw, draws: d, losses: aw }, awayTeam: { wins: aw, draws: d, losses: hw } }, matches: mapped };
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
    return { textContext: contextStr || "[NO H2H/FORM FOUND]", translatedH2H };
}

// 🟢 LOUD API: Tracks true success and logs actual errors
async function postToBufferDirectly(text, safeImgUrl, profileId, token) { 
    if (!profileId || !token) return false;
    const hasImg = safeImgUrl && safeImgUrl.length > 5;
    const query = hasImg ? `mutation($text: String!, $img: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow, assets: { images: [{ url: $img }] } }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }` : `mutation($text: String!) { createPost(input: { text: $text, channelId: "${profileId}", schedulingType: automatic, mode: shareNow }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`;
    const variables = hasImg ? { text: text || "", img: safeImgUrl } : { text: text || "" };
    
    try { 
        const res = await fetch("https://api.buffer.com/1/graphql", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ query, variables }) }); 
        const data = await res.json();
        if (data?.data?.createPost?.message) {
            console.error(`❌ Buffer Error for ${profileId}:`, data.data.createPost.message);
            return false;
        }
        return true;
    } catch (e) { 
        console.error(`❌ Buffer Network Error for ${profileId}:`, e.message); 
        return false;
    }
}

function parseTemplate(templateText, match, analysis, link, dateStr) {
    if (!templateText) return null;
    let text = templateText;
    if (match) text = text.replace(/\[HOME\]/g, match.home_team).replace(/\[AWAY\]/g, match.away_team);
    if (analysis) { text = text.replace(/\[PICK\]/g, analysis.primary).replace(/\[ODDS\]/g, analysis.odds).replace(/\[RATIONALE\]/g, analysis.rationale); }
    if (link) text = text.replace(/\[LINK\]/g, link);
    if (dateStr) text = text.replace(/\[DATE\]/g, dateStr);
    return text;
}

// 🟢 LOUD API: Tracks true success and logs actual Telegram parsing crashes
async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') {
    if (!botToken || !chatId) {
        console.error("❌ Telegram skipped: Missing botToken or chatId");
        return false;
    }
    try { 
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: true }) }); 
        if (!res.ok) {
            const errData = await res.json();
            console.error(`❌ Telegram API Error for ${chatId}:`, JSON.stringify(errData));
            return false;
        }
        return true;
    } catch (e) { 
        console.error("❌ Telegram Network Error:", e.message); 
        return false;
    }
}

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

async function generateWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            if (error.message.includes('PerDay') || error.message.includes('Quota exceeded')) {
                console.log(`   🛑 Google AI Daily Quota Reached.`);
                return null; 
            } else if (error.message.includes('429') || error.message.includes('503')) {
                if (i < maxRetries - 1) {
                    console.log(`   ⏳ Google AI Speed Limit Hit. Waiting 30s...`);
                    await delay(30000); 
                } else { throw error; }
            } else { throw error; }
        }
    }
}

async function runProSlipEngine() {
    console.log("🧠 Starting Automated AI Pro Slip Engine...");

    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const eventsConfig = config.events || {};
    const featuredMatchId = config.featured_match_id; 
    const tgGeneralChannels = creds.tg_general_channels || [];
    const tgVipChannels = creds.tg_vip_channels || [];
    const templates = config.templates?.free_tips || {};

    const now = new Date();
    const todayDateString = now.toISOString().split('T')[0];
    const in24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();
    const currentMonthYear = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const { data: allMatches, error } = await supabase.from('matches').select('*')
        .gte('match_date', now.toISOString()).lte('match_date', in24Hours)
        .neq('status', 'FT').neq('status', 'FINISHED');

    if (error || !allMatches) return;

    let matchesNeedingAnalysis = allMatches.filter(m => !m.pro_analysis || (typeof m.pro_analysis === 'object' && Object.keys(m.pro_analysis).length === 0) || (typeof m.pro_analysis === 'string' && m.pro_analysis.trim() === ''));
    
    const MAX_MATCHES_PER_RUN = 5;
    if (matchesNeedingAnalysis.length > MAX_MATCHES_PER_RUN) {
        matchesNeedingAnalysis = matchesNeedingAnalysis.slice(0, MAX_MATCHES_PER_RUN);
    }

    const newlyGeneratedSlips = [];

    if (matchesNeedingAnalysis.length > 0) {
        console.log(`🎯 Analyzing ${matchesNeedingAnalysis.length} upcoming matches...`);
        for (const match of matchesNeedingAnalysis) {
            console.log(`\n⏳ Analyzing: ${match.home_team} vs ${match.away_team}...`);
            try {
                const tableStr = await getLeagueStandings(match.league);
                const { textContext, translatedH2H } = await getMatchContext(match.league, match.match_date, match.home_team, match.away_team);
                
                const prompt = `
                    You are a gritty, elite football tactical analyst in ${currentMonthYear}. 
                    Provide a highly accurate "Pro Betting Slip" for: ${match.home_team} vs ${match.away_team} (${match.league}). 
                    
                    FACTUAL CONTEXT:
                    LEAGUE STANDING: ${tableStr}
                    MATCH FORM & H2H: ${textContext}
                    
                    CRITICAL RULES: 
                    1. TONE: Be direct, expert, and authoritative. Speak from experience.
                    2. THE "NO DATA" FAIL-SAFE: NEVER complain to the reader about missing data. NEVER use phrases like "With no available data", "Information is scarce", or "Tactical analysis is impossible." If the Factual Context above is sparse or missing, seamlessly rely on your vast internal expert knowledge of these clubs' historical playstyles, pedigree, and league tendencies to formulate a confident rationale.
                `;
                
                let text = await generateWithRetry(prompt);
                if (!text) continue; 
                
                text = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
                const analysisData = JSON.parse(text);
                
                const updatePayload = { pro_analysis: analysisData };
                if (translatedH2H && translatedH2H.matches && translatedH2H.matches.length > 0) {
                    updatePayload.h2h = translatedH2H; 
                }
                
                await supabase.from('matches').update(updatePayload).eq('id', match.id);
                console.log(`   ✅ Saved Elite AI Analysis!`);
                newlyGeneratedSlips.push({ match, analysis: analysisData });
            } catch (err) { console.error(`   🔥 Error processing match:`, err.message); }
            
            await delay(12000); 
        }

        if (newlyGeneratedSlips.length > 0 && eventsConfig.vip_tips?.tg_vip !== false && tgVipChannels.length > 0) {
            console.log(`\n💎 Broadcasting NEW slips to VIP Channels...`);
            for (const channel of tgVipChannels) {
                for (const item of newlyGeneratedSlips) {
                    const matchDateObj = formatDate(item.match.match_date); 
                    // 🟢 SANITIZED FOR TELEGRAM HTML PARSER
                    const safeRationale = escapeHTML(item.analysis.rationale);
                    const safePrimary = escapeHTML(item.analysis.primary);
                    const safeAcca = escapeHTML(item.analysis.safe);
                    
                    const vipMsg = `💎 <b>VIP PRO ANALYSIS</b> 💎\n\n📅 <b>Date:</b> ${matchDateObj}\n⚽️ <b>${item.match.home_team} vs ${item.match.away_team}</b>\n🏆 ${item.match.league}\n\n🎯 <b>Main Value Pick:</b> ${safePrimary} (${item.analysis.odds})\n🛡 <b>Safe Acca Pick:</b> ${safeAcca} (${item.analysis.safeOdds})\n\n🧠 <b>Tactical Rationale:</b>\n<i>${safeRationale}</i>`;
                    
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, vipMsg);
                    await delay(1000); 
                }
            }
        }
    }

    console.log(`\n🎁 Evaluating Free Bet of the Day...`);

    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

    const { data: alreadyPostedToday } = await supabase.from('matches').select('id, pro_analysis')
        .gte('match_date', startOfToday).lte('match_date', endOfToday);
        
    const hasPosted = alreadyPostedToday?.some(m => m.pro_analysis && m.pro_analysis.was_freetip_date === todayDateString);

    if (hasPosted) {
        console.log(`   ⏭️ Free Tip already broadcasted today. Skipping.`);
        console.log("\n🏁 Automated AI Engine Complete!"); return; 
    }
    
    const { data: allAnalyzedToday } = await supabase.from('matches').select('*')
        .not('pro_analysis', 'is', null)
        .gte('match_date', startOfToday)
        .lte('match_date', endOfToday)
        .neq('status', 'FT')
        .neq('status', 'FINISHED');

    let freeTipMatch = null;

    if (allAnalyzedToday && allAnalyzedToday.length > 0) {
        if (featuredMatchId) {
            const forcedMatch = allAnalyzedToday.find(m => String(m.id) === String(featuredMatchId));
            if (forcedMatch && forcedMatch.pro_analysis) { 
                freeTipMatch = forcedMatch; 
                console.log(`   ⚡ Admin Override: ${freeTipMatch.home_team}`); 
            }
        }
        if (!freeTipMatch) {
            const giants = ['Arsenal','Chelsea','Liverpool','Man City','Man United','Real Madrid','Barcelona', 'Bayern', 'Juventus', 'PSG', 'Inter', 'AC Milan', 'Atletico'];
            allAnalyzedToday.sort((a, b) => {
                const aScore = (giants.some(t => a.home_team.includes(t)) ? 1 : 0) + (giants.some(t => a.away_team.includes(t)) ? 1 : 0);
                const bScore = (giants.some(t => b.home_team.includes(t)) ? 1 : 0) + (giants.some(t => b.away_team.includes(t)) ? 1 : 0);
                if (bScore !== aScore) return bScore - aScore; 
                return new Date(b.match_date).getTime() - new Date(a.match_date).getTime(); 
            });
            freeTipMatch = allAnalyzedToday[0];
            console.log(`   🧮 Math Selected: ${freeTipMatch.home_team}`);
        }
    }

    if (freeTipMatch) {
        let successfullyPosted = false;
        const matchLink = `https://factsport.com/match/${freeTipMatch.id}`;
        const matchDateObj = formatDate(freeTipMatch.match_date); 
        
        // 🟢 SANITIZE FREE TIP TEXT SO TELEGRAM DOESN'T CRASH
        const safeAnalysis = {
            ...freeTipMatch.pro_analysis,
            primary: escapeHTML(freeTipMatch.pro_analysis.primary),
            rationale: escapeHTML(freeTipMatch.pro_analysis.rationale)
        };
        
        const fb1Text = parseTemplate(templates.fb1 || `🎁 FREE BET OF THE DAY 🎁\n\n📅 Date: [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Prediction: [PICK]\n🔥 Odds: [ODDS]\n\n👇 See full stats and place your bet!\n[LINK]`, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        const fb2Text = parseTemplate(templates.fb2 || fb1Text, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        const make1Text = parseTemplate(templates.make1 || `🎁 FREE BET OF THE DAY!\n\n📅 [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Pick: [PICK] ([ODDS])\n\n👇 Full stats:\n[LINK]`, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        const make2Text = parseTemplate(templates.make2 || make1Text, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);

        if (eventsConfig.free_tips?.tg_general && tgGeneralChannels.length > 0) {
            for (const channel of tgGeneralChannels) {
                if (channel.wants_freetips) {
                    const linkToUse = channel.link || matchLink; 
                    const rawTgMsg = templates.tg_general || `🎁 <b>FREE BET OF THE DAY</b> 🎁\n\n📅 <b>Date:</b> [DATE]\n⚽️ <b>[HOME] vs [AWAY]</b>\n\n🎯 <b>Prediction:</b> [PICK]\n🔥 <b>Odds:</b> [ODDS]\n\n🧠 <b>Why?:</b> <i>[RATIONALE]</i>\n\n👉 <a href="[LINK]">Bet on this match here!</a>`;
                    const freeTgMsg = parseTemplate(rawTgMsg, freeTipMatch, safeAnalysis, linkToUse, matchDateObj);
                    
                    const tgSuccess = await postToTelegram(creds.telegram_bot_token, channel.chatId, freeTgMsg);
                    if (tgSuccess) successfullyPosted = true;
                    await delay(1000);
                }
            }
        }

        const bufferToken = creds.buffer_token || process.env.BUFFER_ACCESS_TOKEN;

        if (eventsConfig.free_tips?.buf_x1) { const ok = await postToBufferDirectly(make1Text, null, creds.buffer_x1_id, bufferToken); if (ok) successfullyPosted = true; }
        if (eventsConfig.free_tips?.buf_x2) { const ok = await postToBufferDirectly(make2Text, null, creds.buffer_x2_id, bufferToken); if (ok) successfullyPosted = true; }
        if (eventsConfig.free_tips?.buf_fb1) { const ok = await postToBufferDirectly(fb1Text, null, creds.buffer_fb1_id, bufferToken); if (ok) successfullyPosted = true; }
        if (eventsConfig.free_tips?.buf_fb2) { const ok = await postToBufferDirectly(fb2Text, null, creds.buffer_fb2_id, bufferToken); if (ok) successfullyPosted = true; }

        // 🟢 LOUD API: Tracks Webhook Success
        if (eventsConfig.free_tips?.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            try {
                const res = await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb1Text, x_text: make1Text, x_image_url: null }) });
                if (res.ok) { successfullyPosted = true; console.log("✅ Webhook 1 Success"); } 
                else console.error("❌ Webhook 1 Failed:", await res.text());
            } catch(e) { console.error("❌ Webhook 1 Network Error:", e.message); }
        }

        if (eventsConfig.free_tips?.make2 && creds.make_webhook_2) {
            try {
                const res = await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb2Text, x_text: make2Text, x_image_url: null }) });
                if (res.ok) { successfullyPosted = true; console.log("✅ Webhook 2 Success"); } 
                else console.error("❌ Webhook 2 Failed:", await res.text());
            } catch(e) { console.error("❌ Webhook 2 Network Error:", e.message); }
        }

        // 🟢 LOUD API: Tracks FB Graph Success
        if (eventsConfig.free_tips?.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            try {
                const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fb1Text)}&access_token=${token}`, { method: 'POST' });
                if (res.ok) { successfullyPosted = true; console.log("✅ FB1 Graph Success"); } 
                else console.error("❌ FB1 Graph Failed:", await res.text());
            } catch(e) { console.error("❌ FB1 Graph Network Error:", e.message); }
        }

        // 🟢 STRICT DB LOCK: Only locks if one of the APIs above successfully returned a 200 OK status
        if (successfullyPosted) {
            freeTipMatch.pro_analysis.was_freetip_date = todayDateString;
            await supabase.from('matches').update({ pro_analysis: freeTipMatch.pro_analysis }).eq('id', freeTipMatch.id);
            
            if (featuredMatchId) {
                const updatedConfig = { ...config };
                delete updatedConfig.featured_match_id; 
                await supabase.from('site_settings').update({ social_config: updatedConfig }).eq('id', 1);
            }
            console.log(`   🔒 Logged Free Tip in DB & reset Admin Override.`);
        } else {
            console.log(`   ⚠️ ALL social endpoints failed. Database lock bypassed. Will retry next run.`);
        }
    }

    console.log("\n🏁 Engine Complete!");
}
runProSlipEngine();