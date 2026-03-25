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
        'bayern munich': ['bayern', 'bayern munich', 'bayern münchen', 'fc bayern'],
        'borussia dortmund': ['dortmund', 'borussia dortmund'],
        'bayer 04 leverkusen': ['leverkusen', 'bayer 04', 'bayer leverkusen'],
        'bayer leverkusen': ['leverkusen', 'bayer 04', 'bayer leverkusen'],
        // Note how we provide BOTH unaccented and accented versions to the database search!
        'borussia monchengladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'mgladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'monchengladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
        'eintracht frankfurt': ['frankfurt', 'eintracht frankfurt'],
        'rb leipzig': ['leipzig', 'rb leipzig', 'rasenballsport leipzig'],
        'atletico madrid': ['atletico', 'atlético', 'atletico madrid', 'atlético de madrid'],
        'atletico de madrid': ['atletico', 'atlético', 'atletico madrid', 'atlético de madrid'],
        'athletic club': ['athletic', 'athletic bilbao', 'athletic club'],
        'athletic bilbao': ['athletic', 'athletic bilbao'],
        'real sociedad': ['sociedad', 'real sociedad'],
        'real betis': ['betis', 'real betis'],
        'celta vigo': ['celta', 'celta vigo'],
        'barcelona': ['barcelona', 'barca', 'fc barcelona'],
        'real madrid': ['real madrid', 'madrid'],
        'inter milan': ['inter', 'internazionale', 'inter milan'],
        'inter': ['inter', 'internazionale', 'inter milan'],
        'ac milan': ['ac milan', 'milan'],
        'juventus': ['juventus', 'juve'],
        'as roma': ['roma', 'as roma'],
        'ssc napoli': ['napoli', 'ssc napoli'],
        'ss lazio': ['lazio', 'ss lazio'],
        'paris saint germain': ['psg', 'paris saint', 'paris sg', 'paris saint-germain'],
        'psg': ['psg', 'paris saint', 'paris sg'],
        'olympique lyonnais': ['lyon', 'olympique lyonnais'],
        'olympique de marseille': ['marseille', 'olympique de marseille', 'om'],
        'sporting cp': ['sporting', 'sporting cp', 'sporting lisbon', 'sporting clube de portugal'],
        'united states': ['united states', 'usa', 'usmnt', 'uswnt'],
        'usa': ['united states', 'usa']
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