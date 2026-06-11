// app/lib/teamAliases.ts

export function getTeamSearchVariations(teamName: string): string[] {
  if (!teamName) return [];

  const noQuotes = teamName.replace(/['"]/g, '').trim();
  const normalized = noQuotes.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const variationsMap: Record<string, string[]> = {
    'manchester united': ['manchester united', 'man utd', 'man united', 'manchester utd'],
    'manchester city': ['manchester city', 'man city', 'man. city'],
    'tottenham hotspur': ['tottenham', 'spurs', 'tottenham hotspur'],
    'wolverhampton wanderers': ['wolverhampton', 'wolves'],
    'nottingham forest': ['nottingham forest', 'nottm forest', 'nottingham'],
    'sheffield united': ['sheffield united', 'sheff utd', 'sheffield utd'],
    'newcastle united': ['newcastle', 'newcastle utd', 'newcastle united'],
    'west ham united': ['west ham', 'west ham united'],
    'leicester city': ['leicester', 'leicester city'],
    'brighton & hove albion': ['brighton', 'brighton & hove', 'brighton hove'],
    'aston villa': ['aston villa', 'villa'],
    'afc bournemouth': ['bournemouth', 'afc bournemouth'],
    'crystal palace': ['crystal palace', 'palace'],
    'real madrid': ['real madrid', 'madrid'],
    'barcelona': ['barcelona', 'barca', 'fc barcelona'],
    'atletico madrid': ['atletico', 'atlético', 'atletico madrid', 'atlético de madrid'],
    'athletic club': ['athletic', 'athletic bilbao', 'athletic club'],
    'real sociedad': ['sociedad', 'real sociedad'],
    'real betis': ['betis', 'real betis'],
    'celta vigo': ['celta', 'celta vigo'],
    'rayo vallecano': ['rayo', 'rayo vallecano', 'vallecano'],
    'bayern munich': ['bayern', 'bayern munich', 'bayern münchen', 'fc bayern'],
    'borussia dortmund': ['dortmund', 'borussia dortmund'],
    'bayer 04 leverkusen': ['leverkusen', 'bayer 04', 'bayer leverkusen'],
    'borussia monchengladbach': ['gladbach', 'mgladbach', 'monchengladbach', 'mönchengladbach'],
    'rb leipzig': ['leipzig', 'rb leipzig', 'rasenballsport leipzig'],
    'eintracht frankfurt': ['frankfurt', 'eintracht frankfurt'],
    'inter milan': ['inter', 'internazionale', 'inter milan'],
    'ac milan': ['ac milan', 'milan'],
    'juventus': ['juventus', 'juve'],
    'as roma': ['roma', 'as roma'],
    'ssc napoli': ['napoli', 'ssc napoli'],
    'ss lazio': ['lazio', 'ss lazio'],
    'paris saint germain': ['psg', 'paris saint', 'paris sg', 'paris saint-germain'],
    'olympique lyonnais': ['lyon', 'olympique lyonnais'],
    'olympique de marseille': ['marseille', 'olympique de marseille', 'om'],
    'united states': ['united states', 'usa', 'usmnt', 'uswnt'],
    'argentina': ['argentina', 'arg'],
    'brazil': ['brazil', 'brasil'],
    'france': ['france'],
    'england': ['england'],
    'spain': ['spain'],
    'italy': ['italy'],
    'germany': ['germany', 'deutschland'],
    'portugal': ['portugal'],
    'netherlands': ['netherlands', 'holland'],
    'belgium': ['belgium'],
    'croatia': ['croatia'],
    'uruguay': ['uruguay'],
    'colombia': ['colombia'],
    'mexico': ['mexico'],
    'senegal': ['senegal'],
    'morocco': ['morocco'],
    'japan': ['japan'],
    'south korea': ['south korea', 'korea republic', 'korea'],
    'switzerland': ['switzerland'],
    'denmark': ['denmark'],
    'sweden': ['sweden'],
    'poland': ['poland'],
    'wales': ['wales'],
    'scotland': ['scotland'],
    'ireland': ['ireland', 'republic of ireland'],
    'norway': ['norway'],
    'austria': ['austria'],
    'hungary': ['hungary'],
    'serbia': ['serbia'],
    'turkey': ['turkey', 'türkiye'],
    'ukraine': ['ukraine'],
    'czechia': ['czechia', 'czech republic'],
    'greece': ['greece'],
    'romania': ['romania'],
    'chile': ['chile'],
    'peru': ['peru'],
    'ecuador': ['ecuador'],
    'paraguay': ['paraguay'],
    'venezuela': ['venezuela'],
    'bolivia': ['bolivia'],
    'canada': ['canada'],
    'costa rica': ['costa rica'],
    'panama': ['panama'],
    'jamaica': ['jamaica'],
    'nigeria': ['nigeria'],
    'egypt': ['egypt'],
    'cameroon': ['cameroon'],
    'ghana': ['ghana'],
    'ivory coast': ['ivory coast', 'cote divoire', "côte d'ivoire"],
    'algeria': ['algeria'],
    'tunisia': ['tunisia'],
    'mali': ['mali'],
    'iran': ['iran'],
    'iraq': ['iraq'],
    'australia': ['australia'],
    'saudi arabia': ['saudi arabia'],
    'qatar': ['qatar'],
    'uzbekistan': ['uzbekistan'],
    'oman': ['oman'],
    'jordan': ['jordan'],
    'bahrain': ['bahrain'],
    'kyrgyzstan': ['kyrgyzstan'],
    'indonesia': ['indonesia'],
    'malaysia': ['malaysia'],
    'thailand': ['thailand'],
    'vietnam': ['vietnam'],
    'united arab emirates': ['uae', 'united arab emirates'],
    'south africa': ['south africa'],
    'cape verde': ['cape verde', 'cabo verde'],
    'dr congo': ['dr congo', 'congo dr', 'democratic republic of the congo']
  };

  for (const key of Object.keys(variationsMap)) {
    if (normalized === key || variationsMap[key].includes(normalized)) {
      return Array.from(new Set([...variationsMap[key], teamName]));
    }
  }

  const words = noQuotes.split(/\s+/);
  const firstWord = words[0].toLowerCase();

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
      coreWord = words[0];
    } else if (words.length > 1) {
      coreWord = words[1];
    }
  }

  return Array.from(new Set([teamName, noQuotes, normalized, coreWord]));
}

export function getTeamQueryFilter(teamName: string): string {
  if (!teamName) return '';

  const variations = getTeamSearchVariations(teamName);
  const filters = variations.map(v => `home_team.ilike.%${v}%,away_team.ilike.%${v}%`);

  return filters.join(',');
}