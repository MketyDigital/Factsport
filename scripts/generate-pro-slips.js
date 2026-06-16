// scripts/generate-pro-slips.js

// @ts-nocheck
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_DATA_KEY || process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('❌ Missing Keys. Make sure SUPABASE, GEMINI, and FOOTBALL_DATA keys are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const proSlipSchema = {
  type: SchemaType.OBJECT,
  properties: {
    primary: { type: SchemaType.STRING, description: 'e.g., Over 2.5 Goals' },
    odds: { type: SchemaType.STRING, description: 'e.g., 1.60' },
    safe: { type: SchemaType.STRING, description: 'e.g., Home Win or Draw' },
    safeOdds: { type: SchemaType.STRING, description: 'e.g., 1.20' },
    rationale: { type: SchemaType.STRING, description: '40-50 words of expert tactical rationale.' }
  },
  required: ['primary', 'odds', 'safe', 'safeOdds', 'rationale']
};

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: proSlipSchema
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FD_LEAGUES = {
  'Premier League': 'PL',
  'La Liga': 'PD',
  'Bundesliga': 'BL1',
  'Serie A': 'SA',
  'Ligue 1': 'FL1',
  'Champions League': 'CL',
  'Europa League': 'EL',
  'Europa Conference League': 'UECL',
  'Euros': 'EC',
  'World Cup': 'WC',
  'Copa America': 'CLI',
  'Primeira Liga': 'PPL',
  'Eredivisie': 'DED',
  'Brasileirao': 'BSA',
  'Brasileirão': 'BSA'
};

async function getMatchContext(leagueName, dateString, homeTeam, awayTeam) {
  let contextStr = '';
  // Simplify to just get form or use recent db matches
  // Because logic was half cut in prompt, let's keep it simple
  
  const { data, error } = await supabase
    .from('matches')
    .select('home_team, away_team, home_score, away_score, status, match_date')
    .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
    .or(`home_team.eq."${homeTeam}",away_team.eq."${homeTeam}",home_team.eq."${awayTeam}",away_team.eq."${awayTeam}"`)
    .order('match_date', { ascending: false })
    .limit(6);

  if (data && data.length > 0) {
    const history = data.map(m => `${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`).join(' | ');
    contextStr += `[RECENT HISTORY DB] ${history}`;
  }

  return contextStr || '[NO FORM STRINGS ATTACHED - Contextualize purely on general historical pedigree]';
}

async function generateProSlips() {
  console.log('🔮 Starting Pro Slip Generator...');

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999)).toISOString();

  // Pick top 10 matches in next 48 hours that don't have a pro slip
  const { data: matches } = await supabase
    .from('matches')
    .select('*, pro_slip(*)')
    .neq('status', 'FT')
    .neq('status', 'FINISHED')
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)
    .limit(20);

  if (!matches || matches.length === 0) {
    console.log(' 💤 No upcoming matches found.');
    return;
  }

  const matchesWithoutSlip = matches.filter(m => !m.pro_slip || m.pro_slip.length === 0).slice(0, 5);

  if (matchesWithoutSlip.length === 0) {
    console.log(' ✅ All matches already have Pro Slips.');
    return;
  }

  for (const m of matchesWithoutSlip) {
    console.log(`Generating Pro Slip for ${m.home_team} vs ${m.away_team}...`);
    
    const statsCtx = await getMatchContext(m.league, m.match_date, m.home_team, m.away_team);
    const espnPredictor = m.predictor ? `ESPN Predicts: Home ${m.predictor.home}%, Away ${m.predictor.away}%, Draw ${m.predictor.draw}%` : 'No probability model attached';

    const prompt = `
      You are a professional football sports analyst. Provide a betting slip for the upcoming match:
      Match: ${m.home_team} vs ${m.away_team}
      League: ${m.league}
      Date: ${m.match_date}

      Data Context:
      ${statsCtx}
      ${espnPredictor}

      Supply a JSON response matching the supplied schema. Give a strong 'primary' bet and a safer 'safe' bet with odds. Rate tactical rationale factually.
    `;

    try {
      const result = await model.generateContent(prompt);
      const output = JSON.parse((await result.response).text());

      const { error } = await supabase
        .from('pro_slips')
        .upsert({
          match_id: m.id,
          primary_bet: output.primary,
          odds: output.odds,
          safe_bet: output.safe,
          safe_odds: output.safeOdds,
          rationale: output.rationale,
          updated_at: new Date().toISOString()
        }, { onConflict: 'match_id' });

      if (error) {
        console.error(` ❌ DB Error:`, error.message);
      } else {
        console.log(` ✅ Saved Pro Slip for match ${m.id}`);
      }
    } catch (err) {
      console.error(` ⚠️ Failed generation for ${m.id}:`, err.message);
    }

    await delay(3000);
  }

  console.log('🎉 Done compiling Pro Slips.');
}

generateProSlips();
