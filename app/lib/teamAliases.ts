// 🧠 Extract the smartest possible search keyword from any weird team name
export function getCoreTeamName(teamName: string): string {
    if (!teamName) return '';
    
    // 🛡️ 1. WAF Protection: Strip quotes and clean whitespace
    let clean = teamName.replace(/['"]/g, '').trim();

    // 🌍 2. The Master Dictionary (Maps ESPN & Football-Data quirks)
    const aliases: Record<string, string> = {
        // Premier League
        'Wolves': 'Wolverhampton',
        'Wolverhampton Wanderers': 'Wolverhampton',
        'Spurs': 'Tottenham',
        'Tottenham Hotspur': 'Tottenham',
        'Man Utd': 'Manchester United',
        'Manchester Utd': 'Manchester United',
        'Man City': 'Manchester City',
        'Brighton Hove': 'Brighton',
        'Brighton & Hove Albion': 'Brighton',
        'Nottm Forest': 'Nottingham Forest',
        'Sheff Utd': 'Sheffield United',
        'Sheff Wed': 'Sheffield Wednesday',
        'Luton Town': 'Luton',
        'Newcastle Utd': 'Newcastle',
        'West Ham United': 'West Ham',
        'Aston Villa': 'Aston Villa',
        'Leicester City': 'Leicester',

        // Bundesliga
        'Mgladbach': 'gladbach',
        'Moenchengladbach': 'gladbach',
        'Borussia Monchengladbach': 'gladbach',
        'Borussia Mönchengladbach': 'gladbach',
        'Bayern Munich': 'Bayern',
        'FC Bayern München': 'Bayern',
        'Dortmund': 'Dortmund',
        'Borussia Dortmund': 'Dortmund',
        'Bayer 04 Leverkusen': 'Leverkusen',
        'Bayer Leverkusen': 'Leverkusen',
        'Schalke 04': 'Schalke',
        'FC Schalke 04': 'Schalke',
        'Eintracht Frankfurt': 'Frankfurt',
        'SV Werder Bremen': 'Bremen',
        'VfB Stuttgart': 'Stuttgart',
        'RB Leipzig': 'Leipzig',
        'RasenBallsport Leipzig': 'Leipzig',

        // La Liga
        'Atletico Madrid': 'Atletico',
        'Atlético de Madrid': 'Atletico',
        'Athletic Club': 'Athletic',
        'Athletic Bilbao': 'Athletic',
        'Real Betis': 'Betis',
        'Real Sociedad': 'Sociedad',
        'Rayo Vallecano': 'Vallecano',
        'Celta Vigo': 'Celta',

        // Serie A
        'Inter Milan': 'Inter',
        'Internazionale': 'Inter',
        'AC Milan': 'Milan',
        'Juventus': 'Juventus',
        'Juve': 'Juventus',
        'AS Roma': 'Roma',
        'SSC Napoli': 'Napoli',
        'SS Lazio': 'Lazio',
        'Hellas Verona': 'Verona',

        // Ligue 1 & Others
        'PSG': 'Paris Saint',
        'Paris Saint Germain': 'Paris Saint',
        'Paris Saint-Germain': 'Paris Saint',
        'Olympique Lyonnais': 'Lyon',
        'Olympique de Marseille': 'Marseille',
        'Sporting CP': 'Sporting',
        'Sporting Clube de Portugal': 'Sporting',
        'Sporting Lisbon': 'Sporting',
    };

    // Apply alias if it exists
    clean = aliases[clean] || clean;

    const words = clean.split(/\s+/);
    
    // 🚨 3. The Danger Words Check
    // Words that CANNOT be searched alone (prevents mixing up Man City/Man Utd)
    const dangerWords = [
        'manchester', 'man', 'sheffield', 'bristol', 'dundee', 
        'nottingham', 'madrid', 'milan', 'atletico', 'athletic', 
        'real', 'sporting', 'racing', 'dynamo', 'dinamo', 'bayern',
        'red', 'bull', 'aston', 'crystal', 'west', 'borussia', 
        'olympique', 'boca', 'river', 'inter', 'lokomotiv'
    ];

    const firstWord = words[0].toLowerCase();

    // 🔨 4. Determine the core keyword
    if (dangerWords.includes(firstWord)) {
        return clean; // It's a danger word. Keep the full phrase (e.g., "Manchester City")
    } else {
        const genericTerms = ['fc', 'afc', 'cf', 'ud', 'as', 'rc', 'sv', 'sc', 'vfl', 'fsv', 'tsg', 'ssc'];
        if (!genericTerms.includes(firstWord)) {
            return words[0]; // First word is safe (e.g., "Brighton Hove" -> "Brighton")
        } else if (words.length > 1) {
            return words[1]; // Skip 'FC' and return next word (e.g., "FC Barcelona" -> "Barcelona")
        }
    }

    return clean;
}

// 🎯 Generate the fail-proof Supabase filter
export function getTeamQueryFilter(teamName: string): string {
    if (!teamName) return '';
    const coreName = getCoreTeamName(teamName);
    
    // Searches BOTH columns for the core keyword
    return `home_team.ilike.%${coreName}%,away_team.ilike.%${coreName}%`;
}