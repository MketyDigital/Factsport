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
    'Premier League': 'eng.1', 'La Liga': 'esp.1', 'Bundesliga': 'ger.1',
    'Serie A': 'ita.1', 'Ligue 1': 'fra.1', 'Champions League': 'uefa.champions',
    'Euros': 'uefa.euro', 'World Cup': 'fifa.world',
    'Europa League': 'uefa.europa', 'Europa Conference League': 'uefa.conference',
    'FA Cup': 'eng.fa', 'Carabao Cup': 'eng.league_cup', 'Copa del Rey': 'esp.copa_del_rey',
    'Coppa Italia': 'ita.copa_italia', 'Coupe de France': 'fra.coupe_de_france', 'DFB-Pokal': 'ger.dfb_pokal'
};

const getCanonicalName = (rawName) => {
    if (!rawName) return "";
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(1|fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|olympique|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    const aliases = {
        'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
        'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
        'atleti': 'atletico madrid', 'athletic': 'athletic club', 'barca': 'barcelona', 'barça': 'barcelona',
        'bayern': 'bayern munich', 'bvb': 'borussia dortmund', 'dortmund': 'borussia dortmund',
        'juve': 'juventus', 'inter': 'inter milan', 'milan': 'ac milan', 'roma': 'as roma',
        'psg': 'paris saint germain', 'om': 'marseille', 'ol': 'lyon'
    };
    return aliases[name] || name;
};

const isStrongMatch = (dbName, espnName) => {
    const s1 = getCanonicalName(dbName);
    const s2 = getCanonicalName(espnName);
    if (s1.length < 4 || s2.length < 4) return s1 === s2;
    return s1.includes(s2) || s2.includes(s1);
};

// Helper to post to Telegram
async function postToTelegram(botToken, chatId, text, parseMode = 'HTML') {
    if (!botToken || !chatId) return;
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: parseMode, disable_web_page_preview: true })
        });
    } catch (e) {
        console.error("❌ Telegram Post Error:", e.message);
    }
}

async function getEspnIdForMatch(leagueName, dateString, homeTeam, awayTeam) {
    const espnCode = ESPN_LEAGUES[leagueName];
    if (!espnCode) return null;

    const matchDate = new Date(dateString);
    const datesToTry = [
        matchDate.toISOString().split('T')[0].replace(/-/g, ''), 
        new Date(matchDate.getTime() + 86400000).toISOString().split('T')[0].replace(/-/g, ''), 
        new Date(matchDate.getTime() - 86400000).toISOString().split('T')[0].replace(/-/g, '')  
    ];

    for (const dateParam of datesToTry) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${dateParam}`;
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.events) continue;

            const matchedEvent = data.events.find(e => {
                const espnHome = e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
                const espnAway = e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName;
                return isStrongMatch(homeTeam, espnHome) || isStrongMatch(awayTeam, espnAway);
            });

            if (matchedEvent) return matchedEvent.id;
        } catch (e) { continue; }
    }
    return null;
}

async function fetchRichEspnContext(espnId, currentHomeTeam) {
    if (!espnId) return { textContext: null, translatedH2H: null };
    try {
        const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${espnId}`;
        const res = await fetch(url);
        if (!res.ok) return { textContext: null, translatedH2H: null };
        const data = await res.json();
        
        let textContext = "";
        let translatedH2H = null;

        if (data.form && data.form.length >= 2) {
            const team1Form = data.form[0].events.map(e => e.teamResult).join('-');
            const team2Form = data.form[1].events.map(e => e.teamResult).join('-');
            textContext += `\n[Recent Form] ${data.form[0].team.displayName}: ${team1Form} | ${data.form[1].team.displayName}: ${team2Form}`;
        }

        if (data.headToHead && data.headToHead.games && data.headToHead.games.length > 0) {
            let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;
            let mappedMatches = [];

            const h2hStr = data.headToHead.games.slice(0, 4).map(g => {
                const hScore = parseInt(g.homeTeam.score);
                const aScore = parseInt(g.awayTeam.score);
                totalGoals += (hScore + aScore);

                const isHistoricalHomeCurrentHome = isStrongMatch(currentHomeTeam, g.homeTeam.displayName);

                if (hScore === aScore) draws++;
                else if (hScore > aScore) isHistoricalHomeCurrentHome ? homeWins++ : awayWins++;
                else isHistoricalHomeCurrentHome ? awayWins++ : homeWins++;

                mappedMatches.push({
                    utcDate: g.date,
                    homeTeam: { name: g.homeTeam.displayName },
                    awayTeam: { name: g.awayTeam.displayName },
                    score: { fullTime: { home: hScore, away: aScore } }
                });

                return `${g.homeTeam.abbrev} ${hScore}-${aScore} ${g.awayTeam.abbrev}`;
            }).join(', ');
            
            textContext += `\n[Last Meetings] ${h2hStr}`;

            translatedH2H = {
                aggregates: {
                    numberOfMatches: data.headToHead.games.length,
                    totalGoals: totalGoals,
                    homeTeam: { wins: homeWins, draws: draws, losses: awayWins },
                    awayTeam: { wins: awayWins, draws: draws, losses: homeWins }
                },
                matches: mappedMatches
            };
        }

        return { textContext: textContext.trim() || null, translatedH2H };
    } catch (e) {
        return { textContext: null, translatedH2H: null };
    }
}

async function generateWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            if (error.message.includes('PerDay')) {
                console.log(`   🛑 Google AI Daily Quota Reached (20/day). Will resume tomorrow.`);
                return null; 
            } else if (error.message.includes('429') || error.message.includes('503')) {
                if (i < maxRetries - 1) {
                    console.log(`   ⏳ Google AI is busy (Speed Limit). Waiting 30 seconds before retry ${i + 1}/${maxRetries}...`);
                    await delay(30000); 
                } else {
                    throw error; 
                }
            } else {
                throw error; 
            }
        }
    }
}

async function runProSlipEngine() {
    console.log("🧠 Starting Automated AI Pro Slip Generation...");

    // 🟢 FETCH SETTINGS & MULTI-CHANNELS
    const { data: settingsData } = await supabase.from('site_settings').select('social_config').single();
    const config = settingsData?.social_config || {};
    const creds = config.credentials || {};
    const eventsConfig = config.events || {};
    const featuredMatchId = config.featured_match_id; // 🟢 Get Admin Override

    const tgGeneralChannels = creds.tg_general_channels || [];
    const tgVipChannels = creds.tg_vip_channels || [];

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString();
    const in48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000)).toISOString();

    const { data: allMatches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', twoHoursAgo)
        .lte('match_date', in48Hours)
        .neq('status', 'FT')
        .neq('status', 'FINISHED');

    if (error || !allMatches) return;

    const matches = allMatches.filter(m => {
        if (!m.pro_analysis) return true;
        if (typeof m.pro_analysis === 'object' && Object.keys(m.pro_analysis).length === 0) return true;
        if (typeof m.pro_analysis === 'string' && m.pro_analysis.trim() === '') return true;
        return false; 
    });

    if (matches.length === 0) {
        console.log("💤 No matches need AI analysis right now.");
        return;
    }

    console.log(`🎯 Found ${matches.length} matches needing analysis.`);

    const generatedSlips = [];

    for (const match of matches) {
        console.log(`\n⏳ Analyzing: ${match.home_team} vs ${match.away_team}...`);
        
        try {
            const espnId = match.espn_id || await getEspnIdForMatch(match.league, match.match_date, match.home_team, match.away_team);
            
            const { textContext, translatedH2H } = await fetchRichEspnContext(espnId, match.home_team);

            let promptContext = textContext;
            
            if (promptContext) {
                console.log(`   📡 Successfully pulled ESPN Form & H2H!`);
            } else if (match.h2h && match.h2h.aggregates) {
                console.log(`   🗄️ ESPN shallow. Falling back to Football-Data API H2H from DB!`);
                const agg = match.h2h.aggregates;
                promptContext = `[Historical H2H] Matches Played: ${agg.numberOfMatches}. ${match.home_team} Wins: ${agg.homeTeam?.wins || 0}. ${match.away_team} Wins: ${agg.awayTeam?.wins || 0}. Draws: ${agg.homeTeam?.draws || 0}. Total Goals: ${agg.totalGoals}.`;
                
                if (match.h2h.matches && match.h2h.matches.length > 0) {
                    const recentStrs = match.h2h.matches.slice(0, 4).map(m => {
                        const hs = m.score?.fullTime?.home ?? '?';
                        const as = m.score?.fullTime?.away ?? '?';
                        return `${m.homeTeam?.name || 'Home'} ${hs}-${as} ${m.awayTeam?.name || 'Away'}`;
                    });
                    promptContext += `\n[Recent Meetings] ${recentStrs.join(', ')}`;
                }
            } else {
                promptContext = "No historical form or H2H data available. Base prediction purely on current season tactical profiles, manager tendencies, and squad quality.";
                console.log(`   ⚠️ No data found anywhere. Using pure AI tactical fallback.`);
            }

            const prompt = `
                You are an elite football tactical analyst in 2026. Provide a highly accurate "Pro Betting Slip" for:
                ${match.home_team} vs ${match.away_team} (${match.league}).
                
                🔥 PRISTINE DATA CONTEXT: 
                ${promptContext}

                STRICT INSTRUCTIONS:
                1. Base your betting rationale heavily on the Data Context provided above.
                2. NO HALLUCINATIONS. Do not invent exact recent scorelines or player injuries.
                3. Return ONLY a valid JSON object. No markdown. No text outside the JSON.
                {
                    "primary": "Main value bet (e.g., ${match.home_team} to Win + Over 1.5 Goals)",
                    "odds": "Decimal odds between 1.60 and 2.80",
                    "safe": "Safe accumulator bet (e.g., ${match.home_team} Draw No Bet)",
                    "safeOdds": "Decimal odds between 1.20 and 1.50",
                    "rationale": "A 40-50 word technical explanation of why this bet has value based specifically on the Data Context provided and general tactical matchups."
                }
            `;

            let text = await generateWithRetry(prompt);
            
            if (!text) break; 
            
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const analysisData = JSON.parse(text);

            const updatePayload = { pro_analysis: analysisData };
            
            if (translatedH2H && translatedH2H.matches && translatedH2H.matches.length > 0) {
                updatePayload.h2h = translatedH2H; 
            }

            const { error: updateErr } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', match.id);

            if (updateErr) {
                console.error(`   ❌ Failed to save to DB:`, updateErr.message);
            } else {
                console.log(`   ✅ Saved Elite AI Analysis!`);
                generatedSlips.push({ match, analysis: analysisData });
            }

        } catch (err) {
            console.error(`   🔥 Error processing match:`, err.message);
        }
        
        await delay(8000); 
    }
    
    // -------------------------------------------------------------
    // 🚀 TELEGRAM & SOCIAL BROADCAST (Multi-Channel Routing)
    // -------------------------------------------------------------
    if (generatedSlips.length > 0 && creds.telegram_bot_token) {
        console.log(`\n📢 Broadcasting to Telegram...`);

        // 1. VIP CHANNELS (Post EVERY slip to ALL registered VIP channels)
        if (eventsConfig.vip_tips?.tg_vip !== false && tgVipChannels.length > 0) {
            for (const channel of tgVipChannels) {
                for (const item of generatedSlips) {
                    const vipMsg = `💎 <b>VIP PRO ANALYSIS</b> 💎\n\n⚽️ <b>${item.match.home_team} vs ${item.match.away_team}</b>\n🏆 ${item.match.league}\n\n🎯 <b>Main Value Pick:</b> ${item.analysis.primary} (${item.analysis.odds})\n🛡 <b>Safe Acca Pick:</b> ${item.analysis.safe} (${item.analysis.safeOdds})\n\n🧠 <b>Tactical Rationale:</b>\n<i>${item.analysis.rationale}</i>`;
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, vipMsg);
                    await delay(1500); // Safe delay between messages
                }
                console.log(`   ✅ Sent ${generatedSlips.length} tickets to VIP Channel: ${channel.chatId}`);
            }
        }

        // 2. FREE BET OF THE DAY (Strict Sync Logic)
        if (generatedSlips.length > 0) {
            
            // 🟢 STRICT SORTING ALGORITHM: Admin Override -> Latest Kickoff Time
            generatedSlips.sort((a, b) => {
                // Tier 1: Did Admin manually select a featured match?
                if (featuredMatchId) {
                    if (a.match.id === featuredMatchId) return -1;
                    if (b.match.id === featuredMatchId) return 1;
                }

                // Tier 2: The Most Important Rule (Last match scheduled for that day)
                const aTime = new Date(a.match.match_date).getTime();
                const bTime = new Date(b.match.match_date).getTime();
                return bTime - aTime; // Highest time (latest kickoff) comes first
            });

            const freeItem = generatedSlips[0]; 
            const matchLink = `https://factsport.com/match/${freeItem.match.id}`;
            
            const isFbEnabled = eventsConfig.free_tips?.fb !== false;
            const isXEnabled = eventsConfig.free_tips?.x !== false;
            const isTgEnabled = eventsConfig.free_tips?.tg_general !== false;

            // Send to ALL General Telegram Channels (Using their unique links!)
            if (isTgEnabled && tgGeneralChannels.length > 0) {
                for (const channel of tgGeneralChannels) {
                    const linkToUse = channel.link || matchLink; 
                    const freeTgMsg = `🎁 <b>FREE BET OF THE DAY</b> 🎁\n\n⚽️ <b>${freeItem.match.home_team} vs ${freeItem.match.away_team}</b>\n\n🎯 <b>Prediction:</b> ${freeItem.analysis.primary}\n🔥 <b>Odds:</b> ${freeItem.analysis.odds}\n\n🧠 <b>Why?:</b> <i>${freeItem.analysis.rationale}</i>\n\n👉 <a href="${linkToUse}">Bet on this match here!</a>\n\nWant more expert picks? Upgrade to VIP on <a href="https://factsport.com">FactSport</a>!`;
                    
                    await postToTelegram(creds.telegram_bot_token, channel.chatId, freeTgMsg);
                    console.log(`   ✅ Sent Free Tip to General Channel: ${channel.chatId}`);
                    await delay(1500);
                }
            }

            // Send to X and Facebook via Make.com (SAFE ROUTING: ONLY USES MATCH LINK)
            const makeUrl = creds.make_webhook_1 || process.env.MAKE_WEBHOOK_URL;
            if (makeUrl && (isFbEnabled || isXEnabled)) {
                await fetch(makeUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fb2_text: isFbEnabled ? `🎁 FREE BET OF THE DAY 🎁\n\n⚽️ ${freeItem.match.home_team} vs ${freeItem.match.away_team}\n🎯 Prediction: ${freeItem.analysis.primary}\n🔥 Odds: ${freeItem.analysis.odds}\n\n👇 See full stats and place your bet!\n${matchLink}` : null,
                        x_text: isXEnabled ? `🎁 FREE BET OF THE DAY!\n\n⚽️ ${freeItem.match.home_team} vs ${freeItem.match.away_team}\n🎯 Pick: ${freeItem.analysis.primary} (${freeItem.analysis.odds})\n\n👇 Full stats:\n${matchLink}` : null, 
                        x_image_url: null
                    })
                });
                console.log(`   ✅ Fired Free Tip to X/FB Make.com Router.`);
            }
        }
    }

    console.log("\n🏁 Automated AI Pro Slip Generation Complete!");
}

runProSlipEngine();