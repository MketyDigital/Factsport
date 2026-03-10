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

// 🔥 DEEP RESEARCH FIX: Switched to site.web.api.espn.com which is their richer internal endpoint
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

async function runProSlipEngine() {
    console.log("🧠 Starting Automated AI Pro Slip Generation...");

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

    for (const match of matches) {
        console.log(`\n⏳ Analyzing: ${match.home_team} vs ${match.away_team}...`);
        
        try {
            // 🔥 PRIORITIZE DB ID (Exactly what you asked for!)
            const espnId = match.espn_id || await getEspnIdForMatch(match.league, match.match_date, match.home_team, match.away_team);
            
            const { textContext, translatedH2H } = await fetchRichEspnContext(espnId, match.home_team);

            let promptContext = textContext;
            
            // 🟢 THE SMART MULTI-TIER FALLBACK LOGIC
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

            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const analysisData = JSON.parse(text);

            const updatePayload = { pro_analysis: analysisData };
            
            if (translatedH2H && translatedH2H.matches && translatedH2H.matches.length > 0) {
                updatePayload.h2h = translatedH2H; 
                console.log(`   🔄 Overwrote DB H2H data with richer ESPN stats!`);
            }

            const { error: updateErr } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', match.id);

            if (updateErr) console.error(`   ❌ Failed to save to DB:`, updateErr.message);
            else console.log(`   ✅ Saved Elite AI Analysis!`);

        } catch (err) {
            console.error(`   🔥 Error processing match:`, err.message);
        }
        
        await delay(8000); 
    }
    
    console.log("\n🏁 Automated AI Pro Slip Generation Complete!");
}

runProSlipEngine();