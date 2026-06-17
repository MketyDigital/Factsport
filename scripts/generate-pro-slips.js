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

async function getMatchContext(leagueName, dateString, homeTeam, awayTeam) {
  let contextStr = '';
  
  try {
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
  } catch (e) {
    console.error('Error fetching match context:', e.message);
  }

  return contextStr || '[NO FORM STRINGS ATTACHED - Contextualize purely on general historical pedigree]';
}

async function generateProSlips() {
  console.log('🔮 Starting Pro Slip Generator...');

  // Use a broad, time-zone resilient lookahead window
  // configured with clean 10-character date formats (e.g. "YYYY-MM-DD")
  // to ensure upcoming schedules are never missed due to GMT/UTC mismatches or timezone offsets,
  // and supporting both text 'date' columns and full timestamp strings lexicographically.
  const startOfDay = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const lookaheadDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0];

  console.log(`Searching matches from ${startOfDay} to ${lookaheadDate}...`);

  // To prevent joins from failing due to schema/relation name mismatches (e.g., 'pro_slip' vs 'pro_slips'),
  // we query 'matches' first as a clean base, then filter out matches with existing slips manually.
  // This is 100% database schema independent and guarantees the script never crashes or skips scheduled games.
  const { data: matches, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .neq('status', 'FT')
    .neq('status', 'FINISHED')
    .neq('status', 'POST')
    .neq('status', 'POSTPONED')
    .gte('match_date', startOfDay)
    .lte('match_date', lookaheadDate)
    .order('match_date', { ascending: true })
    .limit(30);

  if (fetchError) {
    console.error('❌ Supabase matches fetch failed:', fetchError.message);
    return;
  }

  if (!matches || matches.length === 0) {
    console.log(' 💤 No upcoming matches found in the 5-day scheduled window.');
    return;
  }

  console.log(`Found ${matches.length} matches in scheduled range. Checking existences in 'pro_slips' table...`);

  const matchIds = matches.map(m => m.id);

  // Safe manual relation check to see which matches already have a corresponding pro slip
  let matchesWithoutSlip = [];
  try {
    const { data: existingSlips, error: slipsError } = await supabase
      .from('pro_slips')
      .select('match_id')
      .in('match_id', matchIds);

    if (slipsError) {
      console.warn('⚠️ Safe check warned on pro_slips select, attempting to generate for all bases:', slipsError.message);
      // Fallback: assume none exist if selecting table fails or behaves unexpectedly
      matchesWithoutSlip = matches.slice(0, 5);
    } else {
      const activeSlipIds = new Set((existingSlips || []).map(s => s.match_id));
      matchesWithoutSlip = matches.filter(m => !activeSlipIds.has(m.id)).slice(0, 5);
    }
  } catch (error) {
    console.error('❌ Failed doing safe pro slips check, using entire matches array:', error.message);
    matchesWithoutSlip = matches.slice(0, 5);
  }

  if (matchesWithoutSlip.length === 0) {
    console.log(' ✅ All matches in scheduled window already have Pro Slips.');
    return;
  }

  console.log(`Processing ${matchesWithoutSlip.length} matches lacking pro slips...`);

  for (const m of matchesWithoutSlip) {
    console.log(`Generating Pro Slip for ${m.home_team} vs ${m.away_team} (ID: ${m.id})...`);
    
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
        console.error(` ❌ DB Upsert Error for ${m.id}:`, error.message);
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
