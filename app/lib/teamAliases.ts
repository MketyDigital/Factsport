const getBaseTeamName = (rawName: string): string => {
    if (!rawName) return "";
    let name = rawName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9 ]/g, '') 
        .replace(/\b(1|fc|cf|afc|sc|sv|rc|fk|vfl|fsv|tsg|ssc|bayer|rcd|ud|as|us|osc|cfa|aja|ca|bc|ac|sk|olympique|de)\b/g, '') 
        .replace(/\s+/g, ' ') 
        .trim();

    const aliases: Record<string, string> = {
        'manchester utd': 'manchester united', 'man utd': 'manchester united', 'man city': 'manchester city',
        'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur', 'wolves': 'wolverhampton wanderers',
        'wolverhampton': 'wolverhampton wanderers', 'nottm forest': 'nottingham forest', 'nottingham': 'nottingham forest',
        'sheff utd': 'sheffield united', 'brighton hove albion': 'brighton', 'brighton hove': 'brighton', 
        'west ham united': 'west ham', 'newcastle united': 'newcastle', 'leicester city': 'leicester',
        'sunderland': 'sunderland', 'fulham': 'fulham', 'crystal palace': 'crystal palace', 'liverpool': 'liverpool',
        'afc bournemouth': 'bournemouth', 'luton town': 'luton', 'aston villa fc': 'aston villa', 'arsenal fc': 'arsenal',
        'chelsea fc': 'chelsea', 'everton fc': 'everton', 'brentford fc': 'brentford',
        'atleti': 'atletico madrid', 'sociedad': 'real sociedad', 'betis': 'real betis',
        'athletic': 'athletic club', 'athletic bilbao': 'athletic club', 'osasuna': 'ca osasuna',
        'vallecano': 'rayo vallecano', 'celta': 'celta vigo', 'espanyol barcelona': 'espanyol',
        'getafe cf': 'getafe', 'sevilla fc': 'sevilla', 'barcelona': 'barcelona', 'barca': 'barcelona', 'levante': 'levante',
        'rcd mallorca': 'mallorca', 'cadiz cf': 'cadiz', 'ud almeria': 'almeria', 'ud las palmas': 'las palmas', 'girona fc': 'girona',
        'real madrid cf': 'real madrid', 'valencia cf': 'valencia',
        '1 koln': 'fc cologne', 'koln': 'fc cologne', 'cologne': 'fc cologne',
        'bayern': 'bayern munich', 'bayern munchen': 'bayern munich', 'bvb': 'borussia dortmund',
        'dortmund': 'borussia dortmund', 'gladbach': 'borussia monchengladbach', 'mgladbach': 'borussia monchengladbach',
        'borussia mgladbach': 'borussia monchengladbach', 'leverkusen': 'bayer leverkusen', 'leipzig': 'rb leipzig',
        'frankfurt': 'eintracht frankfurt', 'stuttgart': 'vfb stuttgart', 'mainz': 'mainz 05',
        'hoff': 'tsg hoffenheim', 'hoffenheim': 'tsg hoffenheim', 'union berlin': 'fc union berlin',
        'freiburg': 'sc freiburg', '1 fc heidenheim 1846': 'heidenheim', 'heidenheim 1846': 'heidenheim', 
        'sv darmstadt 98': 'darmstadt', 'darmstadt 98': 'darmstadt', 'vfl bochum 1848': 'bochum', 'fc augsburg': 'augsburg',
        'st pauli': 'sankt pauli', 'fc st pauli': 'sankt pauli',
        'juve': 'juventus', 'inter': 'inter milan', 'internazionale': 'inter milan',
        'milan': 'ac milan', 'roma': 'as roma', 'lazio': 'ss lazio',
        'napoli': 'ssc napoli', 'hellas verona': 'verona', 'cagliari': 'cagliari calcio',
        'genoa': 'genoa', 'genoa cfc': 'genoa', 'torino': 'torino', 'torino fc': 'torino',
        'lecce': 'us lecce', 'us lecce': 'lecce', 'como 1907': 'como', 'atalanta bc': 'atalanta',
        'ac monza': 'monza', 'us sassuolo': 'sassuolo', 'frosinone calcio': 'frosinone', 'us salernitana 1919': 'salernitana',
        'fiorentina': 'acf fiorentina', 'empoli fc': 'empoli', 'bologna fc': 'bologna', 'udinese calcio': 'udinese',
        'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'om': 'marseille',
        'olympique de marseille': 'marseille', 'ol': 'lyon', 'olympique lyonnais': 'lyon', 'olympique lyon': 'lyon', 
        'paris fc': 'paris fc', 
        'auxerre': 'auxerre', 'stade rennais': 'rennes', 'clermont foot 63': 'clermont', 'clermont foot': 'clermont', 
        'toulouse fc': 'toulouse', 'le havre ac': 'le havre', 'mhsc': 'montpellier', 'montpellier hsc': 'montpellier',
        'st etienne': 'saint etienne', 'asse': 'saint etienne', 'lille osc': 'lille', 'ogc nice': 'nice',
        'sporting': 'sporting cp', 'sporting lisbon': 'sporting cp', 'porto': 'fc porto',
        'benfica': 'sl benfica', 'usa': 'united states', 'korea republic': 'south korea',
        'korea': 'south korea', 'bosnia': 'bosnia and herzegovina', 'dr congo': 'congo dr',
        'cote divoire': 'ivory coast', 'fc copenhagen': 'copenhagen', 'shakhtar donetsk': 'shakhtar', 
        'galatasaray sk': 'galatasaray', 'fenerbahce sk': 'fenerbahce', 'red bull salzburg': 'fc salzburg', 
        'slavia praha': 'slavia prague', 'ajax': 'afc ajax', 'psv': 'psv eindhoven', 'celtic fc': 'celtic', 'rangers fc': 'rangers'
    };
    
    return aliases[name] || name;
};

const REVERSE_LOOKUP: Record<string, string[]> = {
    'manchester city': ['Man City', 'Manchester City', 'Manchester City FC'],
    'manchester united': ['Man Utd', 'Man United', 'Manchester Utd', 'Manchester United', 'Manchester United FC'],
    'tottenham hotspur': ['Spurs', 'Tottenham', 'Tottenham Hotspur', 'Tottenham Hotspur FC'],
    'nottingham forest': ['Nottm Forest', "Nott'm Forest", 'Nottingham Forest', 'Nottingham Forest FC'],
    'wolverhampton wanderers': ['Wolves', 'Wolverhampton', 'Wolverhampton Wanderers', 'Wolverhampton Wanderers FC'],
    'newcastle': ['Newcastle', 'Newcastle Utd', 'Newcastle United', 'Newcastle United FC'],
    'brighton': ['Brighton', 'Brighton & Hove Albion', 'Brighton Hove Albion', 'Brighton & Hove Albion FC'],
    'west ham': ['West Ham', 'West Ham Utd', 'West Ham United', 'West Ham United FC'],
    'paris saint germain': ['PSG', 'Paris SG', 'Paris Saint Germain', 'Paris Saint-Germain FC'],
    'bayern munich': ['Bayern', 'Bayern Munich', 'Bayern München', 'FC Bayern München'],
    'borussia dortmund': ['BVB', 'Dortmund', 'Borussia Dortmund', 'BV Borussia 09 Dortmund'],
    'inter milan': ['Inter', 'Inter Milan', 'Internazionale', 'FC Internazionale Milano']
};

export function getTeamQueryFilter(teamName: string): string {
    const baseName = getBaseTeamName(teamName);
    const aliasesToSearch = REVERSE_LOOKUP[baseName] || [teamName, baseName];
    const safeAliases = aliasesToSearch.map(name => name.replace(/"/g, '""'));
    const formattedList = `(${safeAliases.map(name => `"${name}"`).join(',')})`;
    
    return `home_team.in.${formattedList},away_team.in.${formattedList}`;
}