// app/lib/espn.ts

// @ts-nocheck
import { createClient } from '@/app/lib/supabase/client';

export const ESPN_LEAGUES: Record<string, string> = {
  'Premier League': 'eng.1',
  'La Liga': 'esp.1',
  'Bundesliga': 'ger.1',
  'Serie A': 'ita.1',
  'Ligue 1': 'fra.1',

  'Champions League': 'uefa.champions',
  'Europa League': 'uefa.europa',
  'Europa Conference League': 'uefa.conference',

  'FA Cup': 'eng.fa',
  'Carabao Cup': 'eng.league_cup',
  'Copa del Rey': 'esp.copa_del_rey',
  'Coppa Italia': 'ita.copa_italia',
  'Coupe de France': 'fra.coupe_de_france',
  'DFB-Pokal': 'ger.dfb_pokal',

  'World Cup': 'fifa.world',
  'Euros': 'uefa.euro',
  'Copa America': 'conmebol.america',
  'AFCON': 'caf.afcon',
  'International Friendlies': 'fifa.friendly',

  'UEFA Nations League': 'uefa.nations',
  'CONCACAF Nations League': 'concacaf.nations',
  'World Cup Qualifiers (CONMEBOL)': 'fifa.worldq.conmebol',
  'World Cup Qualifiers (UEFA)': 'fifa.worldq.uefa',
  'World Cup Qualifiers (AFC)': 'fifa.worldq.afc',
  'World Cup Qualifiers (CONCACAF)': 'fifa.worldq.concacaf',
  'World Cup Qualifiers (CAF)': 'fifa.worldq.caf',
  'AFCON Qualifiers': 'caf.nations_qual'
};

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);

const safeInt = (value: any) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

const safeText = (value: any) => {
  if (!value) return '';
  return String(value).trim();
};

const extractNotes = (competition: any) => {
  const notes = competition?.notes || [];
  if (!Array.isArray(notes)) return '';
  return notes.map((n: any) => [n.headline, n.type, n.text].filter(Boolean).join(' ')).join(' | ').toLowerCase();
};

const extractGroupSummary = (data: any) => {
  const candidates = [
    data?.groups,
    data?.header?.groups,
    data?.standings,
    data?.header?.standings,
    data?.header?.competitions?.[0]?.standings
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const summary = [];

    for (const group of candidate) {
      const groupName = group?.name || group?.abbreviation || group?.id || group?.standings?.[0]?.group || null;
      const table = Array.isArray(group?.standings)
        ? group.standings
        : Array.isArray(group?.table)
          ? group.table
          : Array.isArray(group)
            ? group
            : [];

      if (!table.length) continue;

      summary.push({
        name: groupName,
        teams: table.slice(0, 8).map((entry: any) => ({
          name: entry?.team?.name || entry?.team?.displayName || entry?.team || 'Unknown',
          points: safeInt(entry?.points ?? entry?.value),
          played: safeInt(entry?.playedGames ?? entry?.played ?? entry?.stats?.find?.((s: any) => s.name === 'Games Played')?.value),
          goalDifference: entry?.goalDifference ?? entry?.goal_difference ?? null
        }))
      });
    }

    if (summary.length) return summary;
  }

  return [];
};

const extractContext = (data: any, header: any) => {
  const competition = header?.competitions?.[0] || {};
  const noteText = extractNotes(competition);
  const groupFromCompetition = competition?.group?.name || competition?.group?.abbreviation || competition?.groupName || null;

  let stage = safeText(competition?.type?.text || competition?.type?.abbreviation || header?.season?.type?.text || 'Regular Season');
  let matchGroup = groupFromCompetition || null;
  let matchType = 'REGULAR_SEASON';
  let round = competition?.roundInfo?.text || competition?.round?.text || competition?.round?.number || header?.week?.number || null;

  if (noteText.includes('final')) {
    stage = 'Final';
    matchType = 'FINAL';
  } else if (noteText.includes('semi')) {
    stage = 'Semi-final';
    matchType = 'SEMI_FINAL';
  } else if (noteText.includes('quarter')) {
    stage = 'Quarter-final';
    matchType = 'QUARTER_FINAL';
  } else if (noteText.includes('round of')) {
    stage = 'Knockout Round';
    matchType = 'KNOCKOUT_ROUND';
  } else if (noteText.includes('group') || matchGroup) {
    stage = 'Group Stage';
    matchType = 'GROUP_STAGE';
  }

  const groupSummary = extractGroupSummary(data);

  return {
    stage,
    match_group: matchGroup,
    match_type: matchType,
    round,
    group_summary: groupSummary,
    knockout: ['FINAL', 'SEMI_FINAL', 'QUARTER_FINAL', 'KNOCKOUT_ROUND'].includes(matchType),
    final: matchType === 'FINAL'
  };
};

const extractStats = (data: any, homeId: string) => {
  const boxscore = data?.boxscore;
  const homeComp = data?.header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home');
  const awayComp = data?.header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away');

  const stats: any = {
    home: {},
    away: {},
    home_penalties: homeComp?.shootoutScore !== undefined ? safeInt(homeComp.shootoutScore) : null,
    away_penalties: awayComp?.shootoutScore !== undefined ? safeInt(awayComp.shootoutScore) : null,
    home_ht: homeComp?.linescores?.[0]?.value !== undefined ? safeInt(homeComp.linescores[0].value) : null,
    away_ht: awayComp?.linescores?.[0]?.value !== undefined ? safeInt(awayComp.linescores[0].value) : null,
    aggregate: homeComp?.series?.summary || awayComp?.series?.summary || data?.header?.series?.summary || null
  };

  const statMap: Record<string, string> = {
    possessionPct: 'possession',
    foulsCommitted: 'fouls',
    wonCorners: 'corners',
    corners: 'corners',
    saves: 'saves',
    shotsSummary: 'shots',
    totalShots: 'shots',
    shotsOnTarget: 'shotsOnTarget',
    shotsOffTarget: 'shotsOffTarget',
    yellowCards: 'yellowCards',
    redCards: 'redCards',
    offsides: 'offsides',
    passAccuracy: 'passAccuracy'
  };

  if (boxscore?.teams && Array.isArray(boxscore.teams)) {
    boxscore.teams.forEach((t: any) => {
      const side = String(t.team?.id) === String(homeId) ? 'home' : 'away';

      if (!t.statistics || !Array.isArray(t.statistics)) return;

      t.statistics.forEach((s: any) => {
        const key = statMap[s.name] || s.name;
        if (!key) return;
        stats[side][key] = s.displayValue !== undefined ? s.displayValue : s.value;
      });
    });
  }

  return stats;
};

const extractLineups = (data: any, homeId: string, homeTeamName: string, awayTeamName: string) => {
  const boxscore = data?.boxscore || {};
  const lineups: any = {
    home: [],
    away: [],
    formations: { home: null, away: null }
  };

  const rosterCandidates = [
    boxscore?.rosters,
    boxscore?.players,
    data?.rosters
  ].filter(Boolean);

  const addRoster = (roster: any[]) => {
    if (!Array.isArray(roster)) return;

    roster.forEach((r: any) => {
      const side = String(r.team?.id) === String(homeId) ? 'home' : 'away';
      const teamName = side === 'home' ? homeTeamName : awayTeamName;

      if (r.formation) lineups.formations[side] = r.formation;

      const athletes = r.athletes || r.roster || r.statistics?.[0]?.athletes || [];
      if (!Array.isArray(athletes)) return;

      lineups[side] = athletes.map((p: any) => ({
        name: p.athlete?.displayName || p.athlete?.fullName || p.displayName || p.shortDisplayName || '',
        number: p.jersey || p.uniform || '',
        position: p.position?.abbreviation || p.position?.name || 'P',
        positionName: p.position?.name || '',
        is_starter: Boolean(p.starter),
        team: teamName
      }));
    });
  };

  rosterCandidates.forEach(addRoster);

  if ((!lineups.home.length || !lineups.away.length) && boxscore?.teams && Array.isArray(boxscore.teams)) {
    boxscore.teams.forEach((t: any) => {
      const side = String(t.team?.id) === String(homeId) ? 'home' : 'away';
      const teamName = side === 'home' ? homeTeamName : awayTeamName;

      if (!Array.isArray(t.roster)) return;

      lineups[side] = t.roster.map((p: any) => ({
        name: p.athlete?.displayName || p.athlete?.fullName || p.displayName || '',
        number: p.jersey || p.uniform || '',
        position: p.position?.abbreviation || p.position?.name || 'P',
        positionName: p.position?.name || '',
        is_starter: Boolean(p.starter),
        team: teamName
      }));
    });
  }

  return lineups;
};

const parseCommentaryEvents = (commentary: any[], rosterDict: any[]) => {
  if (!Array.isArray(commentary) || commentary.length === 0) return [];

  const parsed = commentary
    .filter((c: any) => {
      const text = String(c.text || '').toLowerCase();
      const metaType = String(c.play?.type?.text || '').toLowerCase();

      return (
        text.includes('goal') ||
        text.includes('penalty') ||
        text.includes('card') ||
        text.includes('substitution') ||
        text.includes('var ') ||
        text.includes('overturned') ||
        text.includes('attempt') ||
        metaType.includes('goal') ||
        metaType.includes('card') ||
        metaType.includes('penalty') ||
        metaType.includes('shot') ||
        metaType.includes('substitution')
      );
    })
    .map((c: any) => {
      const text = c.text || '';
      const lowerText = text.toLowerCase();
      const time = c.time?.displayValue || "0'";
      const metaType = String(c.play?.type?.text || '').toLowerCase();

      let type = 'attempt';
      let actionName = 'Match Update';
      let player = '';
      let matchedPlayerName = '';
      let matchedTeamName = '';
      let matchedSide = '';

      if (lowerText.includes('var decision') || lowerText.includes('overturned') || lowerText.includes('disallowed') || lowerText.includes('no goal') || metaType.includes('var')) {
        type = 'var_overturn';
        actionName = 'VAR Decision';
      } else if (lowerText.includes('penalty conceded')) {
        type = 'penalty_awarded';
        actionName = 'Penalty Conceded';
      } else if (lowerText.includes('penalty awarded')) {
        type = 'penalty_awarded';
        actionName = 'Penalty Awarded';
      } else if (lowerText.includes('penalty') && (lowerText.includes('check') || lowerText.includes('var'))) {
        type = 'var_overturn';
        actionName = 'VAR Penalty Check';
      } else if ((lowerText.includes('penalty') && (lowerText.includes('saved') || lowerText.includes('missed'))) || metaType === 'penalty missed' || metaType === 'penalty saved') {
        type = 'penalty_missed';
        actionName = 'Penalty Missed';
      } else if (metaType === 'goal' || lowerText.includes('goal!') || lowerText.includes('own goal by') || (lowerText.includes('goal') && /\d+/.test(lowerText)) || (lowerText.includes('penalty') && lowerText.includes('scored'))) {
        type = 'goal';
        actionName = lowerText.includes('own goal') ? 'Own Goal' : (lowerText.includes('penalty') ? 'Penalty Goal' : 'Goal');
      } else if (lowerText.includes('card') || metaType.includes('card')) {
        type = lowerText.includes('red') ? 'red-card' : 'card';
        actionName = lowerText.includes('red') ? 'Red Card' : 'Yellow Card';
      } else if (lowerText.includes('substitution') || metaType.includes('substitution')) {
        type = 'sub';
        actionName = 'Substitution';
      } else {
        type = 'attempt';
        actionName = lowerText.includes('saved') ? 'Shot Saved' : 'Shot Missed';
      }

      const participants = c.play?.participants || [];

      if (participants.length > 0) {
        matchedPlayerName = participants[0]?.athlete?.displayName || '';
        const exactMatch = rosterDict.find((r) => r.name === matchedPlayerName);

        if (exactMatch) {
          matchedTeamName = exactMatch.teamName;
          matchedSide = exactMatch.side;
        }

        if (type === 'sub' && participants.length > 1) {
          const p1 = participants[0]?.athlete?.displayName || '';
          const p2 = participants[1]?.athlete?.displayName || '';
          const teamMatch = rosterDict.find((r) => r.name === p1);

          if (p1 && p2) {
            player = teamMatch ? `${p1} (In) / ${p2} (Out) (${teamMatch.teamName})` : `${p1} (In) / ${p2} (Out)`;
            if (teamMatch) matchedSide = teamMatch.side;
          }
        }
      }

      if (!player) {
        if (type === 'sub') {
          const matched = rosterDict
            .filter((r) => text.includes(r.name))
            .sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));

          if (matched.length >= 2) {
            player = `${matched[0].name} (In) / ${matched[1].name} (Out) (${matched[0].teamName})`;
            matchedSide = matched[0].side;
          } else if (matched.length === 1) {
            player = `${matched[0].name} (${matched[0].teamName})`;
            matchedSide = matched[0].side;
          }
        } else {
          const ownGoal = text.match(/own goal by ([^.;]+)/i);
          if (ownGoal && !matchedPlayerName) matchedPlayerName = ownGoal[1].trim();

          if (!matchedPlayerName) {
            const match = rosterDict.find((r) => text.includes(r.name));
            if (match) {
              matchedPlayerName = match.name;
              matchedTeamName = match.teamName;
              matchedSide = match.side;
            }
          } else {
            const match = rosterDict.find((r) => r.name === matchedPlayerName);
            if (match) {
              matchedTeamName = match.teamName;
              matchedSide = match.side;
            }
          }

          if (matchedPlayerName) {
            player = matchedTeamName ? `${matchedPlayerName} (${matchedTeamName})` : matchedPlayerName;
          }
        }
      }

      if (type === 'goal' && lowerText.includes('assisted by')) {
        const assistIndex = lowerText.indexOf('assisted by');
        const assistText = text.substring(assistIndex);
        const assistMatch = rosterDict.find((r) => assistText.includes(r.name) && r.name !== matchedPlayerName);

        if (assistMatch) {
          player = `${player || 'Goal'} (Assist: ${assistMatch.name})`;
        } else {
          const regMatch = text.match(/Assisted by (.*?)(?: with|\.)/i);
          if (regMatch) player = `${player || 'Goal'} (Assist: ${regMatch[1].trim()})`;
        }
      }

      if (!player || player.trim() === '' || player.length > 85 || player.toLowerCase().includes('unknown')) {
        if (type === 'goal') player = 'Goal Confirmed';
        else if (type === 'var_overturn') player = 'Goal Disallowed';
        else if (type === 'penalty_awarded') player = 'Penalty Check';
        else if (type === 'penalty_missed') player = 'Penalty Missed';
        else if (type === 'attempt') player = 'Shot on Target';
        else if (type === 'card' || type === 'red-card') player = 'Booking';
        else if (type === 'sub') player = 'Tactical Change';
        else player = 'Match Update';
      }

      return {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        time,
        type,
        text: actionName,
        player,
        team: matchedSide
      };
    });

  parsed.reverse();
  return parsed;
};

export const normalizeName = (name: string) => {
  if (!name) return '';

  const raw = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases: Record<string, string> = {
    'manchester utd': 'manchester united',
    'man utd': 'manchester united',
    'man united': 'manchester united',
    'man city': 'manchester city',
    'spurs': 'tottenham hotspur',
    'tottenham': 'tottenham hotspur',
    'wolves': 'wolverhampton wanderers',
    'nottm forest': 'nottingham forest',
    'nottingham': 'nottingham forest',
    'sheff utd': 'sheffield united',
    'brighton hove albion': 'brighton',
    'brighton hove': 'brighton',
    'west ham united': 'west ham',
    'newcastle united': 'newcastle',
    'leicester city': 'leicester',
    'atleti': 'atletico madrid',
    'sociedad': 'real sociedad',
    'betis': 'real betis',
    'athletic': 'athletic club',
    'athletic bilbao': 'athletic club',
    'vallecano': 'rayo vallecano',
    'celta': 'celta vigo',
    'barca': 'barcelona',
    'koln': 'fc cologne',
    'cologne': 'fc cologne',
    'bayern': 'bayern munich',
    'bayern munchen': 'bayern munich',
    'bvb': 'borussia dortmund',
    'dortmund': 'borussia dortmund',
    'gladbach': 'borussia monchengladbach',
    'leverkusen': 'bayer leverkusen',
    'leipzig': 'rb leipzig',
    'frankfurt': 'eintracht frankfurt',
    'stuttgart': 'vfb stuttgart',
    'mainz': 'mainz 05',
    'juve': 'juventus',
    'inter': 'inter milan',
    'internazionale': 'inter milan',
    'milan': 'ac milan',
    'roma': 'as roma',
    'lazio': 'ss lazio',
    'napoli': 'ssc napoli',
    'psg': 'paris saint germain',
    'paris sg': 'paris saint germain',
    'om': 'marseille',
    'ol': 'lyon',
    'sporting': 'sporting cp',
    'porto': 'fc porto',
    'benfica': 'sl benfica',
    'usa': 'united states',
    'usmnt': 'united states',
    'uswnt': 'united states',
    'korea republic': 'south korea',
    'korea': 'south korea',
    'bosnia': 'bosnia and herzegovina',
    'dr congo': 'congo dr',
    'cote divoire': 'ivory coast',
    'ivory coast': 'ivory coast',
    'czech republic': 'czechia'
  };

  return aliases[raw] || raw;
};

export async function fetchEspnLive(leagueCode: string, dates?: string) {
  const params = new URLSearchParams();
  if (dates) params.set('dates', dates);
  params.set('_', String(Date.now()));

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?${params.toString()}`;

  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !data.events) return [];

    return data.events.map((e: any) => {
      const comp = e.competitions?.[0];
      const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away');
      const noteText = extractNotes(comp);

      let stage = comp?.type?.text || comp?.type?.abbreviation || 'Regular Season';
      let matchGroup = comp?.group?.name || comp?.group?.abbreviation || null;
      let matchType = 'REGULAR_SEASON';

      if (noteText.includes('final')) {
        stage = 'Final';
        matchType = 'FINAL';
      } else if (noteText.includes('semi')) {
        stage = 'Semi-final';
        matchType = 'SEMI_FINAL';
      } else if (noteText.includes('quarter')) {
        stage = 'Quarter-final';
        matchType = 'QUARTER_FINAL';
      } else if (noteText.includes('group') || matchGroup) {
        stage = 'Group Stage';
        matchType = 'GROUP_STAGE';
      }

      return {
        espn_id: String(e.id),
        status: e.status?.type?.state === 'post' ? 'FT' : (e.status?.type?.state === 'in' ? 'LIVE' : 'SCHEDULED'),
        clock: e.status?.type?.description === 'Halftime' ? 'HT' : (e.status?.displayClock || "0'"),
        home_team: homeComp?.team?.displayName || 'Home Team',
        away_team: awayComp?.team?.displayName || 'Away Team',
        home_score: safeInt(homeComp?.score),
        away_score: safeInt(awayComp?.score),
        startTime: e.date ? new Date(e.date).getTime() : 0,
        date: e.date,
        league: '',
        stage,
        match_group: matchGroup,
        match_type: matchType,
        home_logo: homeComp?.team?.logo || null,
        away_logo: awayComp?.team?.logo || null
      };
    });
  } catch (err) {
    return [];
  }
}

export async function fetchEspnDetails(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(gameId)}&_=${Date.now()}`;

  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;

    const data = await res.json();
    const header = data?.header;
    const competition = header?.competitions?.[0];

    if (!header || !competition) return null;

    const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === 'away');
    const homeId = String(homeCompetitor?.team?.id || '');
    const homeTeamName = homeCompetitor?.team?.displayName || '';
    const awayTeamName = awayCompetitor?.team?.displayName || '';

    const currentStatus = header.status?.type?.state || 'pre';
    let currentClock = header.status?.type?.description === 'Halftime' ? 'HT' : (header.status?.displayClock || "0'");

    if (data.commentary && data.commentary.length > 0 && currentClock !== 'HT' && currentStatus === 'in') {
      const latestTimeStr = data.commentary[0]?.time?.displayValue;
      if (latestTimeStr && latestTimeStr.includes("'")) {
        const cleanClock = currentClock.replace(/:.*/, '');
        const clockNum = safeInt(cleanClock.replace(/\D/g, ''));
        const eventNum = safeInt(latestTimeStr.replace(/\D/g, ''));

        if (eventNum > clockNum) currentClock = latestTimeStr;
        else if (eventNum === clockNum && latestTimeStr.includes('+') && !currentClock.includes('+')) currentClock = latestTimeStr;
      }
    }

    let mappedStatus = 'SCHEDULED';
    if (currentStatus === 'in') mappedStatus = 'LIVE';
    if (currentStatus === 'post') mappedStatus = 'FT';
    if (currentClock === 'HT') mappedStatus = 'HT';

    const context = extractContext(data, header);
    const rosterDict: { name: string, side: string, teamName: string }[] = [];
    const lineups = extractLineups(data, homeId, homeTeamName, awayTeamName);

    ['home', 'away'].forEach((side) => {
      const teamName = side === 'home' ? homeTeamName : awayTeamName;
      if (Array.isArray(lineups[side])) {
        lineups[side].forEach((p: any) => {
          if (p.name) rosterDict.push({ name: p.name, side, teamName });
        });
      }
    });

    rosterDict.sort((a, b) => b.name.length - a.name.length);

    const events = parseCommentaryEvents(data.commentary, rosterDict);

    return {
      events,
      match_events: events,
      stats: extractStats(data, homeId),
      lineups,
      venue: data.gameInfo?.venue?.fullName || null,
      attendance: data.gameInfo?.attendance || null,
      referees: data.gameInfo?.officials?.map((o: any) => o.displayName || o.fullName).filter(Boolean) || [],
      predictor: data.predictor
        ? {
            home: safeInt(data.predictor.homeTeam?.gameProjection || 0),
            away: safeInt(data.predictor.awayTeam?.gameProjection || 0),
            draw: safeInt(data.predictor.draw?.gameProjection || 0)
          }
        : null,
      stage: context.stage,
      match_group: context.match_group,
      match_type: context.match_type,
      round: context.round,
      group_summary: context.group_summary,
      knockout: context.knockout,
      final: context.final,
      home_team: homeTeamName,
      away_team: awayTeamName,
      home_logo: homeCompetitor?.team?.logo || null,
      away_logo: awayCompetitor?.team?.logo || null,
      status: mappedStatus,
      home_score: safeInt(homeCompetitor?.score),
      away_score: safeInt(awayCompetitor?.score),
      displayClock: currentClock
    };
  } catch (err) {
    console.error('ESPN Fetch Details Error:', err);
    return null;
  }
}