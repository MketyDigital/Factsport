const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { 
    console.error("❌ Missing Supabase Keys."); 
    process.exit(1); 
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ESPN_CUPS = {
    'Europa League': 'uefa.europa',
    'Europa Conference League': 'uefa.conference',
    'FA Cup': 'eng.fa',
    'Carabao Cup': 'eng.league_cup',
    'Copa del Rey': 'esp.copa_del_rey',
    'Coppa Italia': 'ita.copa_italia',
    'Coupe de France': 'fra.coupe_de_france',
    'DFB-Pokal': 'ger.dfb_pokal',
    'International Friendlies': 'fifa.friendly',
    'UEFA Nations League': 'uefa.nations',
    'CONCACAF Nations League': 'concacaf.nations',
    'World Cup Qualifiers (CONMEBOL)': 'fifa.worldq.conmebol',
    'World Cup Qualifiers (UEFA)': 'fifa.worldq.uefa',
    'World Cup Qualifiers (AFC)': 'fifa.worldq.afc',
    'World Cup Qualifiers (CONCACAF)': 'fifa.worldq.concacaf',
    'AFCON Qualifiers': 'caf.nations_qual',
    'World Cup': 'fifa.world',
    'Euros': 'uefa.euro',
    'Copa America': 'conmebol.america'
};

const normalizeEspnStatus = (state, matchDate) => {
    const matchTime = new Date(matchDate).getTime();
    const now = Date.now();

    if (matchTime > now + (1000 * 60 * 60) && state === 'post') {
        return 'SCHEDULED';
    }

    if (state === 'pre') return 'SCHEDULED';
    if (state === 'in') return 'LIVE';
    if (state === 'post') return 'FT';
    return 'SCHEDULED';
};

const isFakeMatch = (homeName, awayName) => {
    const combined = `${homeName} ${awayName}`.toLowerCase();
    return combined.includes(' u1') || 
           combined.includes(' u2') || 
           combined.includes('esports') || 
           combined.includes('women');
};

async function fetchEspnCups() {
    console.log("🏆 Starting ESPN Cup Sync (-3 to +35 Days)...");
    
    const today = new Date();
    const fromDate = new Date(today); fromDate.setDate(today.getDate() - 3);
    const toDate = new Date(today); toDate.setDate(today.getDate() + 35); 
    
    const fromStr = fromDate.toISOString().split('T')[0].replace(/-/g, '');
    const toStr = toDate.toISOString().split('T')[0].replace(/-/g, '');
    const datesParam = `${fromStr}-${toStr}`;

    for (const [leagueName, espnCode] of Object.entries(ESPN_CUPS)) {
        console.log(`\n📡 Fetching ${leagueName}...`);
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnCode}/scoreboard?dates=${datesParam}`;

        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            
            const events = data.events || [];
            if (events.length === 0) {
                console.log(`   💤 No matches found.`);
                continue;
            }

            const matchesToUpsert = [];

            for (const e of events) {
                const espnId = String(e.id);
                const homeCompetitor = e.competitions[0].competitors.find(c => c.homeAway === 'home');
                const awayCompetitor = e.competitions[0].competitors.find(c => c.homeAway === 'away');
                
                const homeName = homeCompetitor.team.displayName;
                const awayName = awayCompetitor.team.displayName;

                if (isFakeMatch(homeName, awayName)) continue;

                matchesToUpsert.push({
                    api_id: espnId,     
                    espn_id: espnId,    
                    league: leagueName,
                    home_team: homeName,
                    away_team: awayName,
                    home_score: parseInt(homeCompetitor.score) || 0,
                    away_score: parseInt(awayCompetitor.score) || 0,
                    match_date: e.date,
                    status: normalizeEspnStatus(e.status.type.state, e.date),
                    home_logo: homeCompetitor.team.logo || null,
                    away_logo: awayCompetitor.team.logo || null,
                    updated_at: new Date().toISOString()
                });
            }

            if (matchesToUpsert.length > 0) {
                // The SQL unique constraint we added makes this a true 'update if exists'
                const { error } = await supabase.from('matches').upsert(matchesToUpsert, { onConflict: 'api_id' });
                if (error) {
                    console.error(`   ❌ DB Error: ${error.message}`);
                } else {
                    console.log(`   ✅ Synced ${matchesToUpsert.length} matches for ${leagueName}`);
                }
            }
        } catch (err) {
            console.error(`   🔥 Error fetching ${leagueName}: ${err.message}`);
        }
    }
    console.log("\n🏁 ESPN Cup Sync Complete!");
}

fetchEspnCups();