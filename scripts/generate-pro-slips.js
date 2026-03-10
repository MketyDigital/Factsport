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

const cleanName = (name) => name.toLowerCase().replace(/ fc| cf| united| city| real| atletico| athletic/g, '').trim();

async function getEspnIdForMatch(leagueName, dateString, homeTeam, awayTeam) {
    const espnCode = ESPN_LEAGUES[leagueName];
    if (!espnCode) return null;

    const dateParam = new Date(dateString).toISOString().split('T')[0].replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${dateParam}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.events) return null;

        const cleanHome = cleanName(homeTeam);
        const cleanAway = cleanName(awayTeam);

        const matchedEvent = data.events.find(e => {
            const espnHome = cleanName(e.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName);
            const espnAway = cleanName(e.competitions[0].competitors.find(c => c.homeAway === 'away').team.displayName);
            return (espnHome.includes(cleanHome) || cleanHome.includes(espnHome)) || 
                   (espnAway.includes(cleanAway) || cleanAway.includes(espnAway));
        });

        return matchedEvent ? matchedEvent.id : null;
    } catch (e) { return null; }
}

async function fetchRichEspnContext(espnId, currentHomeTeam) {
    if (!espnId) return { textContext: null, translatedH2H: null };
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${espnId}`;
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

        if (data.headToHead && data.headToHead.games) {
            let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0;
            let mappedMatches = [];

            const h2hStr = data.headToHead.games.slice(0, 4).map(g => {
                const hScore = parseInt(g.homeTeam.score);
                const aScore = parseInt(g.awayTeam.score);
                totalGoals += (hScore + aScore);

                const isHistoricalHomeCurrentHome = cleanName(g.homeTeam.displayName).includes(cleanName(currentHomeTeam));

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

        return { textContext: textContext.trim(), translatedH2H };
    } catch (e) {
        return { textContext: null, translatedH2H: null };
    }
}

async function runProSlipEngine() {
    console.log("🧠 Starting Automated AI Pro Slip Generation...");

    const now = new Date();
    // Look a little bit into the past just in case timezones are weird
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString();
    const in48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000)).toISOString();

    // Fetch ALL active/scheduled matches
    const { data: allMatches, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_date', twoHoursAgo)
        .lte('match_date', in48Hours)
        .neq('status', 'FT')
        .neq('status', 'FINISHED');

    if (error || !allMatches) {
        console.error("❌ DB Error:", error?.message);
        return;
    }

    // 🔥 JS FILTER: Safely check if pro_analysis is truly empty
    const matches = allMatches.filter(m => {
        if (!m.pro_analysis) return true;
        // If it's an empty string or empty JSON object, it needs analysis!
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
            const espnId = match.espn_id || await getEspnIdForMatch(match.league, match.match_date, match.home_team, match.away_team);
            
            const { textContext, translatedH2H } = await fetchRichEspnContext(espnId, match.home_team);

            let promptContext = textContext;
            if (!promptContext) {
                promptContext = "No historical form data available. Base prediction purely on tactical profiles.";
                console.log(`   ⚠️ No ESPN data found. Using AI tactical fallback.`);
            }

            const prompt = `
                You are an elite football tactical analyst in 2026. Provide a highly accurate "Pro Betting Slip" for:
                ${match.home_team} vs ${match.away_team} (${match.league}).
                
                🔥 PRISTINE DATA CONTEXT: 
                ${promptContext}

                STRICT INSTRUCTIONS:
                1. Base your betting rationale heavily on the "Recent Form" and "Last Meetings" provided above.
                2. NO HALLUCINATIONS. Do not invent exact recent scorelines or player injuries.
                3. Return ONLY a valid JSON object. No markdown. No text outside the JSON.
                {
                    "primary": "Main value bet (e.g., ${match.home_team} to Win + Over 1.5 Goals)",
                    "odds": "Decimal odds between 1.60 and 2.80",
                    "safe": "Safe accumulator bet (e.g., ${match.home_team} Draw No Bet)",
                    "safeOdds": "Decimal odds between 1.20 and 1.50",
                    "rationale": "A 40-50 word technical explanation of why this bet has value based specifically on the Form/H2H data provided and general tactical matchups."
                }
            `;

            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const analysisData = JSON.parse(text);

            const updatePayload = { pro_analysis: analysisData };
            if (translatedH2H) {
                updatePayload.h2h = translatedH2H; 
                console.log(`   🔄 Translated and Overwrote H2H data with ESPN stats!`);
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
        
        await delay(3000); 
    }
    
    console.log("\n🏁 Automated AI Pro Slip Generation Complete!");
}

runProSlipEngine();