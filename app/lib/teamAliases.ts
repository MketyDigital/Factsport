// 🧠 Extract a smart array of search variations for ANY team
export function getTeamSearchVariations(teamName: string): string[] {
    if (!teamName) return [];
    
    // 🛡️ 1. Strip quotes (M'gladbach -> Mgladbach)
    const noQuotes = teamName.replace(/['"]/g, '').trim();

    // 🌍 2. The Diacritic Killer: Removes accents for a safe dictionary lookup
    // Turns "Mönchengladbach" -> "monchengladbach" and "Atlético" -> "atletico"
    const normalized = noQuotes.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // 🗺️ 3. The Master Multi-Variation Dictionary
    // Keys MUST be fully normalized (lowercase, no accents, no quotes)
    const variationsMap: Record<string, string[]> = {
        // PREMIER LEAGUE
        'manchester united': ['manchester united', 'man utd', 'man united', 'manchester utd'],
        'man utd': ['manchester united', 'man utd', 'man united', 'manchester utd'],
        'manchester city': ['manchester city', 'man city', 'man. city'],
        'man city': ['manchester city', 'man city', 'man. city'],
        'tottenham hotspur': ['tottenham', 'spurs', 'tottenham hotspur'],
        'tottenham': ['tottenham', 'spurs', 'tottenham hotspur'],
        'spurs': ['tottenham', 'spurs'],
        'wolverhampton wanderers': ['wolverhampton', 'wolves'],
        'wolverhampton': ['wolverhampton', 'wolves'],
        'wolves': ['wolverhampton', 'wolves'],
        'nottingham forest': ['nottingham forest', 'nottm forest', 'nottingham'],
        'nottm forest': ['nottingham forest', 'nottm forest', 'nottingham'],
        'sheffield united': ['sheffield united', 'sheff utd', 'sheffield utd'],
        'sheff utd': ['sheffield united', 'sheff utd', 'sheffield utd'],
        'newcastle united': ['newcastle', 'newcastle utd', 'newcastle united'],
        'newcastle utd': ['newcastle', 'newcastle utd'],
        'west ham united': ['west ham', 'west ham united'],
        'leicester city': ['leicester', 'leicester city'],
        'brighton & hove albion': ['brighton', 'brighton & hove', 'brighton hove'],
        'brighton hove': ['brighton', 'brighton & hove'],
        'aston villa': ['aston villa', 'villa'],
        'afc bournemouth': ['bournemouth', 'afc bournemouth'],
        'crystal palace': ['crystal palace', 'palace'],
        
        // BUNDESLIGA
        'bayern munich': ['bayern', 'bayern munich', 'bayern münchen', 'fc bayern'],
        'borussia dortmund': ['dortmund', 'borussia dortmund', 'bvb'],
        'bayer 04 leverkusen': ['leverkusen', 'bayer 04', 'bayer leverkusen'],
        'bayer leverkusen': ['leverkusen', 'bayer 04', 'bayer leverkusen'],
        'borussia monchengladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'mgladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'monchengladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'eintracht frankfurt': ['frankfurt', 'eintracht frankfurt'],
        'rb leipzig': ['leipzig', 'rb leipzig', 'rasenballsport leipzig'],
        
        // LA LIGA
        'atletico madrid': ['atletico', 'atlético', 'atletico madrid', 'atlético de madrid'],
        'atletico de madrid': ['atletico', 'atlético', 'atletico madrid', 'atlético de madrid'],
        'athletic club': ['athletic', 'athletic bilbao', 'athletic club'],
        'athletic bilbao': ['athletic', 'athletic bilbao'],
        'real sociedad': ['sociedad', 'real sociedad'],
        'real betis': ['betis', 'real betis'],
        'celta vigo': ['celta', 'celta vigo'],
        'barcelona': ['barcelona', 'barca', 'fc barcelona'],
        'real madrid': ['real madrid', 'madrid'],
        
        // SERIE A & LIGUE 1 & REST OF EUROPE
        'inter milan': ['inter', 'internazionale', 'inter milan'],
        'inter': ['inter', 'internazionale', 'inter milan'],
        'ac milan': ['ac milan', 'milan'],
        'juventus': ['juventus', 'juve'],
        'as roma': ['roma', 'as roma'],
        'ssc napoli': ['napoli', 'ssc napoli'],
        'ss lazio': ['lazio', 'ss lazio'],
        'paris saint germain': ['psg', 'paris saint', 'paris sg', 'paris saint-germain'],
        'psg': ['psg', 'paris saint', 'paris sg'],
        'olympique lyonnais': ['lyon', 'olympique lyonnais', 'ol'],
        'olympique de marseille': ['marseille', 'olympique de marseille', 'om'],
        'sporting cp': ['sporting', 'sporting cp', 'sporting lisbon', 'sporting clube de portugal'],
        
        // NATIONAL TEAMS
        'argentina': ['argentina', 'arg', 'albiceleste'],
        'brazil': ['brazil', 'brasil', 'bra', 'selecao', 'seleção'],
        'france': ['france', 'fra', 'les bleus'],
        'england': ['england', 'eng', 'three lions'],
        'spain': ['spain', 'españa', 'espana', 'esp', 'la roja'],
        'italy': ['italy', 'italia', 'ita', 'azzurri'],
        'germany': ['germany', 'deutschland', 'ger', 'die mannschaft'],
        'portugal': ['portugal', 'por', 'selecao das quinas'],
        'netherlands': ['netherlands', 'holland', 'ned', 'oranje'],
        'belgium': ['belgium', 'bel', 'red devils'],
        'croatia': ['croatia', 'hrvatska', 'cro', 'vatreni'],
        'uruguay': ['uruguay', 'uru', 'la celeste'],
        'colombia': ['colombia', 'col', 'los cafeteros'],
        'united states': ['united states', 'usa', 'usmnt', 'uswnt'],
        'usa': ['united states', 'usa', 'usmnt', 'uswnt'],
        'mexico': ['mexico', 'mex', 'el tri'],
        'senegal': ['senegal', 'sen', 'lions of teranga'],
        'morocco': ['morocco', 'mar', 'atlas lions'],
        'japan': ['japan', 'jpn', 'samurai blue'],
        'south korea': ['south korea', 'korea republic', 'korea', 'kor', 'taeguk warriors'],
        'korea republic': ['south korea', 'korea republic', 'korea', 'kor'],
        'switzerland': ['switzerland', 'sui', 'rossocrociati'],
        'denmark': ['denmark', 'den', 'danish dynamite'],
        'sweden': ['sweden', 'swe', 'blagult'],
        'poland': ['poland', 'pol', 'bialo-czerwoni'],
        'wales': ['wales', 'wal', 'cymru'],
        'scotland': ['scotland', 'sco', 'tartan army'],
        'ireland': ['ireland', 'republic of ireland', 'irl', 'boys in green'],
        'republic of ireland': ['ireland', 'republic of ireland', 'irl'],
        'norway': ['norway', 'nor'],
        'austria': ['austria', 'aut', 'das team'],
        'hungary': ['hungary', 'hun', 'magyarok'],
        'serbia': ['serbia', 'srb', 'orlovi'],
        'turkey': ['turkey', 'turkiye', 'türkiye', 'tur', 'ay-yildizlilar'],
        'ukraine': ['ukraine', 'ukr', 'zhovto-blakytni'],
        'czech republic': ['czech republic', 'czechia', 'cze'],
        'czechia': ['czech republic', 'czechia', 'cze'],
        'greece': ['greece', 'gre', 'ethniki'],
        'romania': ['romania', 'rou', 'tricolorii'],
        'chile': ['chile', 'chi', 'la roja'],
        'peru': ['peru', 'per', 'la blanquirroja'],
        'ecuador': ['ecuador', 'ecu', 'la tri'],
        'paraguay': ['paraguay', 'par', 'la albirroja'],
        'venezuela': ['venezuela', 'ven', 'la vinotinto'],
        'bolivia': ['bolivia', 'bol', 'la verde'],
        'canada': ['canada', 'can', 'canmnt', 'canwnt'],
        'costa rica': ['costa rica', 'crc', 'los ticos'],
        'panama': ['panama', 'pan', 'los canaleros'],
        'jamaica': ['jamaica', 'jam', 'reggae boyz'],
        'nigeria': ['nigeria', 'nga', 'super eagles'],
        'egypt': ['egypt', 'egy', 'pharaohs'],
        'cameroon': ['cameroon', 'cmr', 'indomitable lions'],
        'ghana': ['ghana', 'gha', 'black stars'],
        'ivory coast': ['ivory coast', 'cote divoire', "cote d'ivoire", "côte d'ivoire", 'civ', 'elephants'],
        'cote divoire': ['ivory coast', 'cote divoire', "cote d'ivoire", "côte d'ivoire", 'civ'],
        'algeria': ['algeria', 'alg', 'fennecs'],
        'tunisia': ['tunisia', 'tun', 'eagles of carthage'],
        'mali': ['mali', 'mli', 'eagles'],
        'iran': ['iran', 'irn', 'team melli'],
        'iraq': ['iraq', 'irq', 'lions of mesopotamia'],
        'australia': ['australia', 'aus', 'socceroos'],
        'saudi arabia': ['saudi arabia', 'ksa', 'green falcons'],
        'qatar': ['qatar', 'qat', 'the maroons'],
        'uae': ['uae', 'united arab emirates'],
        'united arab emirates': ['uae', 'united arab emirates'],
        'south africa': ['south africa', 'rsa', 'bafana bafana'],
        'dr congo': ['dr congo', 'congo dr', 'cod', 'leopards'],
        'congo dr': ['dr congo', 'congo dr', 'cod'],
        'bosnia and herzegovina': ['bosnia', 'bosnia and herzegovina', 'bih'],
        'bosnia': ['bosnia', 'bosnia and herzegovina', 'bih'],
        'georgia': ['georgia', 'geo', 'jvarosnebi'],
        'albania': ['albania', 'alb', 'kuqezinjte'],
        'slovenia': ['slovenia', 'svn'],
        'slovakia': ['slovakia', 'svk', 'repre'],
        'new zealand': ['new zealand', 'nzl', 'all whites']
    };

    // 4. Check if the normalized string matches our map
    for (const key of Object.keys(variationsMap)) {
        if (normalized === key || variationsMap[key].includes(normalized)) {
            // Return all known variations PLUS the raw string the user typed just to be safe
            return Array.from(new Set([...variationsMap[key], teamName]));
        }
    }

    // 5. Dynamic Fallback for generic/unmapped teams (e.g. "Enyimba FC")
    const words = noQuotes.split(/\s+/);
    const firstWord = words[0].toLowerCase();
    
    // 🚨 Danger words that CANNOT be searched alone
    const dangerWords = [
        'manchester', 'man', 'sheffield', 'bristol', 'dundee', 
        'nottingham', 'madrid', 'milan', 'atletico', 'athletic', 
        'real', 'sporting', 'racing', 'dynamo', 'dinamo', 'bayern',
        'red', 'bull', 'aston', 'crystal', 'west', 'borussia', 
        'olympique', 'boca', 'river', 'inter', 'lokomotiv',
        'united', 'us', 'national', 'club', 'new', 'south', 'north',
        'east', 'st', 'st.', 'san', 'santa', 'sao', 'são', 'paris',
        'le', 'la', 'los', 'de', 'el', 'en', 'fc'
    ];

    let coreWord = noQuotes;
    if (!dangerWords.includes(firstWord)) {
        const genericTerms = ['fc', 'afc', 'cf', 'ud', 'as', 'rc', 'sv', 'sc', 'vfl', 'fsv', 'tsg', 'ssc'];
        if (!genericTerms.includes(firstWord)) {
            coreWord = words[0]; // e.g. "Brighton Hove" -> "Brighton"
        } else if (words.length > 1) {
            coreWord = words[1]; // e.g. "FC Barcelona" -> "Barcelona"
        }
    }

    // Return an array of the original name, the unquoted name, the normalized name, and the core word.
    // This blankets the database with all possible combinations!
    return Array.from(new Set([teamName, noQuotes, normalized, coreWord]));
}

// 🎯 Generate the fail-proof Supabase Multi-Filter
export function getTeamQueryFilter(teamName: string): string {
    if (!teamName) return '';
    const variations = getTeamSearchVariations(teamName);
    
    // Creates a massive OR string covering all bases:
    // home_team.ilike.%man city%,away_team.ilike.%man city%,home_team.ilike.%manchester city%...
    const filters = variations.map(v => `home_team.ilike.%${v}%,away_team.ilike.%${v}%`);
    return filters.join(',');
}