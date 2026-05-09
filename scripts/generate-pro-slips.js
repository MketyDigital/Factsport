const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ESPN_LEAGUES = {
    'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Bundesliga': 'ger.1', 'Serie A': 'ita.1', 'Ligue 1': 'fra.1', 
    'Champions League': 'uefa.champions', 'Euros': 'uefa.euro', 'World Cup': 'fifa.world', 'Europa League': 'uefa.europa', 
    'Europa Conference League': 'uefa.conference', 'FA Cup': 'eng.fa', 'Carabao Cup': 'eng.league_cup', 
    'Copa del Rey': 'esp.copa_del_rey', 'Coppa Italia': 'ita.copa_italia', 'Coupe de France': 'fra.coupe_de_france', 'DFB-Pokal': 'ger.dfb_pokal'
};

const getCanonicalName = (rawName) => {
    if (!rawName) return "";
    return rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '')
        .replace(/\b(1|fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|olympique|de)\b/g, '')
        .replace(/\s+/g, ' ').trim();
};

const isStrongMatch = (dbName, espnName) => {
    const s1 = getCanonicalName(dbName);
    const s2 = getCanonicalName(espnName);
    if (s1.length < 4 || s2.length < 4) return s1 === s2;
    return s1.includes(s2) || s2.includes(s1);
};

// 🟢 DYNAMIC TEMPLATE PARSER
function parseTemplate(templateText, match, analysis, link, dateStr) {
    if (!templateText) return null;
    let text = templateText;
    if (match) {
        text = text.replace(/\[HOME\]/g, match.home_team).replace(/\[AWAY\]/g, match.away_team);
    }
    if (analysis) {
        text = text.replace(/\[PICK\]/g, analysis.primary)
                   .replace(/\[ODDS\]/g, analysis.odds)
                   .replace(/\[RATIONALE\]/g, analysis.rationale);
    }
    if (link) text = text.replace(/\[LINK\]/g, link);
    if (dateStr) text = text.replace(/\[DATE\]/g, dateStr);
    return text;
}

async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') {
    if (!botToken || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: true })
        });
    } catch (e) { console.error("❌ Telegram Error:", e.message); }
}

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

async function getEspnIdForMatch(leagueName, dateString, homeTeam, awayTeam) {
    const espnCode = ESPN_LEAGUES[leagueName];
    if (!espnCode) return null;
    const matchDate = new Date(dateString);
    const datesToTry = [
        matchDate.toISOString().split('T')[0].replace(/-/g, ''), 
        new Date(matchDate.getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, ''), 
        new Date(matchDate.getTime() - 86400000).toISOString().split('T')[0].replace(/-/g, '')  
    ];
    for (const dp of datesToTry) {
        try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${dp}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.events) continue;
            const matchedEvent = data.events.find(e => {
                const h = e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
                const a = e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName;
                return isStrongMatch(homeTeam, h) || isStrongMatch(awayTeam, a);
            });
            if (matchedEvent) return matchedEvent.id;
        } catch (e) { continue; }
    }
    return null;
}

async function fetchRichEspnContext(espnId, currentHomeTeam) {
    if (!espnId) return { textContext: null, translatedH2H: null };
    try {
        const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${espnId}`);
        if (!res.ok) return { textContext: null, translatedH2H: null };
        const data = await res.json();
        let textContext = "";
        let translatedH2H = null;

        if (data.form && data.form.length >= 2) {
            const t1 = data.form[0].events.map(e => e.teamResult).join('-');
            const t2 = data.form[1].events.map(e => e.teamResult).join('-');
            textContext += `\n[Recent Form] ${data.form[0].team.displayName}: ${t1} | ${data.form[1].team.displayName}: ${t2}`;
        }
        if (data.headToHead && data.headToHead.games && data.headToHead.games.length > 0) {
            let hw = 0, aw = 0, d = 0, tg = 0;
            let mapped = [];
            const h2hStr = data.headToHead.games.slice(0, 4).map(g => {
                const hs = parseInt(g.homeTeam.score); const as = parseInt(g.awayTeam.score);
                tg += (hs + as);
                const isHistHome = isStrongMatch(currentHomeTeam, g.homeTeam.displayName);
                if (hs === as) d++; else if (hs > as) isHistHome ? hw++ : aw++; else isHistHome ? aw++ : hw++;
                mapped.push({ utcDate: g.date, homeTeam: { name: g.homeTeam.displayName }, awayTeam: { name: g.awayTeam.displayName }, score: { fullTime: { home: hs, away: as } } });
                return `${g.homeTeam.abbrev} ${hs}-${as} ${g.awayTeam.abbrev}`;
            }).join(', ');
            textContext += `\n[Last Meetings] ${h2hStr}`;
            translatedH2H = { aggregates: { numberOfMatches: data.headToHead.games.length, totalGoals: tg, homeTeam: { wins: hw, draws: d, losses: aw }, awayTeam: { wins: aw, draws: d, losses: hw } }, matches: mapped };
        }
        return { textContext: textContext.trim() || null, translatedH2H };
    } catch (e) { return { textContext: null, translatedH2H: null }; }
}

async function generateWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            if (error.message.includes('PerDay') || error.message.includes('429')) {
                console.log(`   ⏳ Google AI is busy. Waiting 30s...`); await delay(30000); 
            } else { throw error; }
        }
    }
}

async function runProSlipEngine() {
    console.log("🧠 Starting Automated AI Pro Slip Generation & Routing...");

    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const eventsConfig = config.events || {};
    const featuredMatchId = config.featured_match_id; 
    const tgGeneralChannels = creds.tg_general_channels || [];
    const tgVipChannels = creds.tg_vip_channels || [];
    const freeTipsConfig = eventsConfig.free_tips || {};
    const templates = config.templates?.free_tips || {};

    const now = new Date();
    const todayDateString = now.toISOString().split('T')[0];
    const in24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();

    const { data: allMatches, error } = await supabase.from('matches').select('*')
        .gte('match_date', now.toISOString()).lte('match_date', in24Hours)
        .neq('status', 'FT').neq('status', 'FINISHED');

    if (error || !allMatches) return;

    // --- PHASE 1: VIP GENERATION ---
    const matchesNeedingAnalysis = allMatches.filter(m => !m.pro_analysis || (typeof m.pro_analysis === 'object' && Object.keys(m.pro_analysis).length === 0) || (typeof m.pro_analysis === 'string' && m.pro_analysis.trim() === ''));
    const newlyGeneratedSlips = [];

    if (matchesNeedingAnalysis.length > 0) {
        console.log(`🎯 Found ${matchesNeedingAnalysis.length} upcoming matches needing VIP analysis.`);
        for (const match of matchesNeedingAnalysis) {
            console.log(`\n⏳ Analyzing: ${match.home_team} vs ${match.away_team}...`);
            try {
                const espnId = match.espn_id || await getEspnIdForMatch(match.league, match.match_date, match.home_team, match.away_team);
                const { textContext, translatedH2H } = await fetchRichEspnContext(espnId, match.home_team);
                const prompt = `You are an elite football tactical analyst in 2026. Provide a highly accurate "Pro Betting Slip" for: ${match.home_team} vs ${match.away_team} (${match.league}). Data Context: ${textContext || "No historical form available. Base prediction on current tactical profiles."} Return ONLY a valid JSON object: {"primary": "Value bet", "odds": "1.60", "safe": "Safe bet", "safeOdds": "1.20", "rationale": "40-50 words."}`;
                let text = await generateWithRetry(prompt);
                if (!text) continue; 
                text = text.replace(/```json/gi, '').replace(/
```/g, '').trim();
                const analysisData = JSON.parse(text);
                const updatePayload = { pro_analysis: analysisData };
                if (translatedH2H && translatedH2H.matches.length > 0) updatePayload.h2h = translatedH2H; 
                await supabase.from('matches').update(updatePayload).eq('id', match.id);
                console.log(`   ✅ Saved Elite AI Analysis!`);
                newlyGeneratedSlips.push({ match, analysis: analysisData });
            } catch (err) { console.error(`   🔥 Error processing match:`, err.message); }
            await delay(8000); 
        }

        if (newlyGeneratedSlips.length > 0 && eventsConfig.vip_tips?.tg_vip !== false && tgVipChannels.length > 0) {
            console.log(`\n💎 Broadcasting NEW slips to VIP Channels...`);
            for (const channel of tgVipChannels) {
                for (const item of newlyGeneratedSlips) {
                    const matchDateObj = formatDate(item.match.match_date); 
                    const vipMsg = `💎 <b>VIP PRO ANALYSIS</b> 💎\n\n📅 <b>Date:</b> ${matchDateObj}\n⚽️ <b>${item.match.home_team} vs ${item.match.away_team}</b>\n🏆 ${item.match.league}\n\n🎯 <b>Main Value Pick:</b> ${item.analysis.primary} (${item.analysis.odds})\n🛡 <b>Safe Acca Pick:</b> ${item.analysis.safe} (${item.analysis.safeOdds})\n\n🧠 <b>Tactical Rationale:</b>\n<i>${item.analysis.rationale}</i>`;
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, vipMsg);
                    await delay(1500); 
                }
            }
        }
    } else { console.log("💤 No new upcoming matches need VIP analysis right now."); }

    // --- PHASE 2: FREE TIP SELECTION & ROUTING ---
    console.log(`\n🎁 Evaluating Free Bet of the Day...`);

    if (config.last_freetip_broadcast_date === todayDateString) {
        console.log(`   ⏭️ Free Tip already broadcasted today. Skipping to prevent double-posting.`);
        console.log("\n🏁 Automated AI Engine Complete!"); return; 
    }
    
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

    const { data: allAnalyzedToday } = await supabase.from('matches').select('*').not('pro_analysis', 'is', null).gte('match_date', startOfToday).lte('match_date', endOfToday);

    let freeTipMatch = null;

    if (allAnalyzedToday && allAnalyzedToday.length > 0) {
        if (featuredMatchId) {
            // NEW LOGIC: Verify the featured match is actually scheduled for today
            const forcedMatch = allAnalyzedToday.find(m => String(m.id) === String(featuredMatchId));
            if (forcedMatch && forcedMatch.pro_analysis) { 
                freeTipMatch = forcedMatch; 
                console.log(`   ⚡ Admin Override: ${freeTipMatch.home_team}`); 
            } else {
                console.log(`   ⚠️ Admin match is not scheduled for today (or lacks analysis). Falling back to auto-selection.`);
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
        
        // 🟢 APPLY DASHBOARD TEMPLATES (With Fallbacks)
        const fb1Text = parseTemplate(templates.fb1 || `🎁 FREE BET OF THE DAY 🎁\n\n📅 Date: [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Prediction: [PICK]\n🔥 Odds: [ODDS]\n\n👇 See full stats and place your bet!\n[LINK]`, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        const fb2Text = parseTemplate(templates.fb2 || fb1Text, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        
        const make1Text = parseTemplate(templates.make1 || `🎁 FREE BET OF THE DAY!\n\n📅 [DATE]\n⚽️ [HOME] vs [AWAY]\n🎯 Pick: [PICK] ([ODDS])\n\n👇 Full stats:\n[LINK]`, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);
        const make2Text = parseTemplate(templates.make2 || make1Text, freeTipMatch, freeTipMatch.pro_analysis, matchLink, matchDateObj);

        // TELEGRAM ROUTING
        if (freeTipsConfig.tg_general && tgGeneralChannels.length > 0) {
            for (const channel of tgGeneralChannels) {
                if (channel.wants_freetips) {
                    const linkToUse = channel.link || matchLink; 
                    const rawTgMsg = templates.tg_general || `🎁 <b>FREE BET OF THE DAY</b> 🎁\n\n📅 <b>Date:</b> [DATE]\n⚽️ <b>[HOME] vs [AWAY]</b>\n\n🎯 <b>Prediction:</b> [PICK]\n🔥 <b>Odds:</b> [ODDS]\n\n🧠 <b>Why?:</b> <i>[RATIONALE]</i>\n\n👉 <a href="[LINK]">Bet on this match here!</a>`;
                    const freeTgMsg = parseTemplate(rawTgMsg, freeTipMatch, freeTipMatch.pro_analysis, linkToUse, matchDateObj);
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, freeTgMsg);
                    successfullyPosted = true; await delay(1500);
                }
            }
        }

        // MAKE.COM 1
        if (freeTipsConfig.make1 && (creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL)) {
            await fetch(creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb1Text, x_text: make1Text }) }).then(() => successfullyPosted = true).catch(()=>{});
        }
        // MAKE.COM 2
        if (freeTipsConfig.make2 && creds.make_webhook_2) {
            await fetch(creds.make_webhook_2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fb2_text: fb2Text, x_text: make2Text }) }).then(() => successfullyPosted = true).catch(()=>{});
        }
        // FACEBOOK 1
        if (freeTipsConfig.fb1 && (creds.fb1_id || process.env.FB_PAGE_ID) && (creds.fb1_token || process.env.FB_ACCESS_TOKEN)) {
            const pageId = creds.fb1_id || process.env.FB_PAGE_ID; const token = creds.fb1_token || process.env.FB_ACCESS_TOKEN;
            await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed?message=${encodeURIComponent(fb1Text)}&access_token=${token}`, { method: 'POST' }).then(() => successfullyPosted = true).catch(()=>{});
        }
        // FACEBOOK 2
        if (freeTipsConfig.fb2 && creds.fb2_id && creds.fb2_token) {
            await fetch(`https://graph.facebook.com/v19.0/${creds.fb2_id}/feed?message=${encodeURIComponent(fb2Text)}&access_token=${creds.fb2_token}`, { method: 'POST' }).then(() => successfullyPosted = true).catch(()=>{});
        }

        if (successfullyPosted) {
            // NEW LOGIC: Clear the featured match ID to reset for tomorrow
            const updatedConfig = { ...config, last_freetip_broadcast_date: todayDateString };
            delete updatedConfig.featured_match_id; 

            await supabase.from('site_settings').update({ social_config: updatedConfig }).eq('id', 1);
            console.log(`   🔒 Saved broadcast date & reset Admin Override for tomorrow.`);
        }
    } else { console.log(`   💤 No analyzed matches found for today. Skipping Free Tip broadcast.`); }

    console.log("\n🏁 Automated AI Engine Complete!");
}
runProSlipEngine();