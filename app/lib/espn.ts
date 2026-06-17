// app/lib/espn.ts

// @ts-nocheck
export const ESPN_LEAGUES: Record<string, string> = {
  "Premier League": "eng.1",
  "La Liga": "esp.1",
  Bundesliga: "ger.1",
  "Serie A": "ita.1",
  "Ligue 1": "fra.1",

  "Champions League": "uefa.champions",
  "Europa League": "uefa.europa",
  "Europa Conference League": "uefa.conference",

  "FA Cup": "eng.fa",
  "Carabao Cup": "eng.league_cup",
  "Copa del Rey": "esp.copa_del_rey",
  "Coppa Italia": "ita.copa_italia",
  "Coupe de France": "fra.coupe_de_france",
  "DFB-Pokal": "ger.dfb_pokal",

  "World Cup": "fifa.world",
  Euros: "uefa.euro",
  "Copa America": "conmebol.america",
  AFCON: "caf.afcon",
  "International Friendlies": "fifa.friendly",

  "UEFA Nations League": "uefa.nations",
  "CONCACAF Nations League": "concacac.nations",
  "World Cup Qualifiers (CONMEBOL)": "fifa.worldq.conmebol",
  "World Cup Qualifiers (UEFA)": "fifa.worldq.uefa",
  "World Cup Qualifiers (AFC)": "fifa.worldq.afc",
  "World Cup Qualifiers (CONCACAF)": "fifa.worldq.concacaf",
  "World Cup Qualifiers (CAF)": "fifa.worldq.caf",
  "AFCON Qualifiers": "caf.nations_qual"
};

const TERMINAL_STATUSES = new Set(["FT", "FINISHED", "AET", "PEN", "AWARDED", "ABD"]);

const safeNumber = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : null;
};

const safeInt = (value: any, fallback = 0) => {
  const n = safeNumber(value);
  return n === null ? fallback : n;
};

const safeFloat = (value: any, fallback = 0) => {
  const n = safeNumber(value);
  return n === null ? fallback : n;
};

const safeNullableInt = (value: any) => {
  const n = safeNumber(value);
  return n === null ? null : n;
};

const safeText = (value: any) => {
  if (!value) return "";
  return String(value).trim();
};

const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
};

const extractNotes = (competition: any) => {
  const notes = competition?.notes || [];
  if (!Array.isArray(notes)) return "";

  return notes
    .map((n: any) => [n.headline, n.type, n.text].filter(Boolean).join(" "))
    .join(" | ")
    .toLowerCase();
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

    const summary: any[] = [];

    for (const group of candidate) {
      const groupName =
        group?.name ||
        group?.abbreviation ||
        group?.id ||
        group?.header?.name ||
        group?.standings?.[0]?.group ||
        "Group";

      const table =
        Array.isArray(group?.standings)
          ? group.standings
          : Array.isArray(group?.table)
            ? group.table
            : Array.isArray(group?.entries)
              ? group.entries
              : Array.isArray(group)
                ? group
                : [];

      if (!table.length) continue;

      summary.push({
        name: groupName,
        teams: table.slice(0, 8).map((entry: any) => ({
          name: entry?.team?.name || entry?.team?.displayName || entry?.team || "Unknown",
          points: safeInt(entry?.points ?? entry?.value),
          played: safeInt(
            entry?.playedGames ??
            entry?.played ??
            entry?.stats?.find?.((s: any) => s.name === "Games Played")?.value
          ),
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

  let stage = safeText(competition?.type?.text || competition?.type?.abbreviation || header?.season?.type?.text || "Regular Season");
  let matchGroup = groupFromCompetition || null;
  let matchType = "REGULAR_SEASON";
  let round = competition?.roundInfo?.text || competition?.round?.text || competition?.round?.number || header?.week?.number || null;

  if (noteText.includes("final")) {
    stage = "Final";
    matchType = "FINAL";
  } else if (noteText.includes("semi")) {
    stage = "Semi-final";
    matchType = "SEMI_FINAL";
  } else if (noteText.includes("quarter")) {
    stage = "Quarter-final";
    matchType = "QUARTER_FINAL";
  } else if (noteText.includes("round of")) {
    stage = "Knockout Round";
    matchType = "KNOCKOUT_ROUND";
  } else if (noteText.includes("group") || matchGroup) {
    stage = "Group Stage";
    matchType = "GROUP_STAGE";
  }

  const groupSummary = extractGroupSummary(data);

  return {
    stage,
    match_group: matchGroup,
    match_type: matchType,
    round,
    group_summary: groupSummary,
    knockout: ["FINAL", "SEMI_FINAL", "QUARTER_FINAL", "KNOCKOUT_ROUND"].includes(matchType),
    final: matchType === "FINAL"
  };
};

const normalizeName = (name: string) => {
  if (!name) return "";

  const raw = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    "manchester utd": "manchester united",
    "man utd": "manchester united",
    "man united": "manchester united",
    "man city": "manchester city",
    spurs: "tottenham hotspur",
    tottenham: "tottenham hotspur",
    wolves: "wolverhampton wanderers",
    "nottm forest": "nottingham forest",
    nottingham: "nottingham forest",
    "sheff utd": "sheffield united",
    "brighton hove albion": "brighton",
    "brighton hove": "brighton",
    "west ham united": "west ham",
    "newcastle united": "newcastle",
    "leicester city": "leicester",
    atleti: "atletico madrid",
    sociedad: "real sociedad",
    betis: "real betis",
    athletic: "athletic club",
    "athletic bilbao": "athletic club",
    vallecano: "rayo vallecano",
    celta: "celta vigo",
    barca: "barcelona",
    koln: "fc cologne",
    cologne: "fc cologne",
    bayern: "bayern munich",
    "bayern munchen": "bayern munich",
    bvb: "borussia dortmund",
    dortmund: "borussia dortmund",
    gladbach: "borussia monchengladbach",
    leverkusen: "bayer leverkusen",
    leipzig: "rb leipzig",
    frankfurt: "eintracht frankfurt",
    stuttgart: "vfb stuttgart",
    "mainz 05": "mainz 05",
    juve: "juventus",
    inter: "inter milan",
    internazionale: "inter milan",
    milan: "ac milan",
    roma: "as roma",
    lazio: "ss lazio",
    napoli: "ssc napoli",
    psg: "paris saint germain",
    "paris sg": "paris saint germain",
    om: "marseille",
    ol: "lyon",
    sporting: "sporting cp",
    porto: "fc porto",
    benfica: "sl benfica",
    usa: "united states",
    usmnt: "united states",
    uswnt: "united states",
    "korea republic": "south korea",
    korea: "south korea",
    bosnia: "bosnia and herzegovina",
    "dr congo": "congo dr",
    "cote divoire": "ivory coast",
    "ivory coast": "ivory coast",
    "czech republic": "czechia"
  };

  return aliases[raw] || raw;
};

const isHalftime = (description: string, clock: string) => {
  const detail = String(description || "").toLowerCase();
  const cleanClock = String(clock || "").toUpperCase();
  return detail.includes("halftime") || detail.includes("half-time") || cleanClock === "HT";
};

const scoreFromCompetitor = (competitor: any) => {
  const direct = safeNumber(competitor?.score);
  if (direct !== null) return direct;

  const linescores = Array.isArray(competitor?.linescores) ? competitor.linescores : [];
  if (linescores.length > 0) {
    return linescores.reduce((sum: number, line: any) => sum + (safeNumber(line?.value) || 0), 0);
  }

  return 0;
};

const extractStats = (data: any, homeId: string, homeTeamName: string, awayTeamName: string) => {
  const boxscore = data?.boxscore || {};
  const homeComp = data?.header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home");
  const awayComp = data?.header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away");
  const awayId = String(awayComp?.team?.id || "");

  const stats: any = {
    home: {},
    away: {},
    home_penalties: safeNullableInt(homeComp?.shootoutScore),
    away_penalties: safeNullableInt(awayComp?.shootoutScore),
    home_ht: safeNullableInt(homeComp?.linescores?.[0]?.value),
    away_ht: safeNullableInt(awayComp?.linescores?.[0]?.value),
    aggregate: homeComp?.series?.summary || awayComp?.series?.summary || data?.header?.series?.summary || null
  };

  const statMap: Record<string, string> = {
    possessionPct: "possession",
    Possession: "possession",
    "Possession %": "possession",
    foulsCommitted: "fouls",
    Fouls: "fouls",
    wonCorners: "corners",
    Corners: "corners",
    corners: "corners",
    saves: "saves",
    Saves: "saves",
    shotsSummary: "shots",
    totalShots: "shots",
    Shots: "shots",
    shots: "shots",
    shotsOnTarget: "shotsOnTarget",
    "Shots on Goal": "shotsOnTarget",
    "Shots On Target": "shotsOnTarget",
    shotsOffTarget: "shotsOffTarget",
    "Shots off Goal": "shotsOffTarget",
    "Shots Off Target": "shotsOffTarget",
    yellowCards: "yellowCards",
    "Yellow Cards": "yellowCards",
    redCards: "redCards",
    "Red Cards": "redCards",
    offsides: "offsides",
    Offsides: "offsides",
    passAccuracy: "passAccuracy",
    "Pass Accuracy": "passAccuracy"
  };

  if (boxscore?.teams && Array.isArray(boxscore.teams)) {
    boxscore.teams.forEach((t: any) => {
      const teamId = String(t.team?.id || "");
      const teamName = safeText(t.team?.displayName || t.team?.name || "");

      let side: string | null = null;
      if (teamId === String(homeId)) side = "home";
      else if (teamId === String(awayId)) side = "away";
      else if (normalizeName(teamName) === normalizeName(homeTeamName)) side = "home";
      else if (normalizeName(teamName) === normalizeName(awayTeamName)) side = "away";

      if (!side || !t.statistics || !Array.isArray(t.statistics)) return;

      t.statistics.forEach((s: any) => {
        const key = statMap[s.name] || statMap[String(s.name).trim()] || s.name;
        if (!key) return;

        stats[side][key] =
          s.displayValue !== undefined && s.displayValue !== null
            ? String(s.displayValue)
            : s.value;
      });
    });
  }

  return stats;
};

const normalizePlayer = (p: any) => {
  const athlete = p?.athlete || {};

  return {
    name:
      athlete?.displayName ||
      athlete?.fullName ||
      p?.displayName ||
      p?.shortDisplayName ||
      p?.name ||
      "",
    number: p?.jersey || p?.uniform || athlete?.jersey || "",
    position: p?.position?.abbreviation || p?.position?.name || "P",
    positionName: p?.position?.name || "",
    is_starter: Boolean(p?.starter),
    team: ""
  };
};

const extractLineups = (data: any, homeId: string, homeTeamName: string, awayTeamName: string) => {
  const boxscore = data?.boxscore || {};
  const awayId = String(
    data?.header?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away")?.team?.id || ""
  );

  const lineups: any = {
    home: [],
    away: [],
    formations: { home: null, away: null }
  };

  const seen = new Set<string>();

  const sideForTeam = (team: any) => {
    const teamId = String(team?.id || "");
    const teamName = safeText(team?.displayName || team?.name || "");

    if (teamId === String(homeId) || normalizeName(teamName) === normalizeName(homeTeamName)) return "home";
    if (teamId === String(awayId) || normalizeName(teamName) === normalizeName(awayTeamName)) return "away";
    return null;
  };

  const mergePlayers = (side: string | null, players: any[], formation?: string) => {
    if (!side || !Array.isArray(players)) return;

    if (formation) lineups.formations[side] = formation;

    players.forEach((raw: any) => {
      const player = normalizePlayer(raw);
      if (!player.name) return;

      player.team = side === "home" ? homeTeamName : awayTeamName;

      const key = `${player.name}|${player.number}|${player.position}`;
      if (seen.has(key)) return;

      seen.add(key);
      lineups[side].push(player);
    });
  };

  if (Array.isArray(boxscore?.teams)) {
    boxscore.teams.forEach((t: any) => {
      const side = sideForTeam(t.team);
      mergePlayers(side, t.roster || t.players || t.athletes || [], t.formation);
    });
  }

  const rosterGroups: any[] = [];

  if (Array.isArray(boxscore?.players)) rosterGroups.push(...boxscore.players);
  else if (boxscore?.players && typeof boxscore.players === "object") rosterGroups.push(...Object.values(boxscore.players));

  if (Array.isArray(boxscore?.rosters)) rosterGroups.push(...boxscore.rosters);
  else if (boxscore?.rosters && typeof boxscore.rosters === "object") rosterGroups.push(...Object.values(boxscore.rosters));

  if (Array.isArray(data?.rosters)) rosterGroups.push(...data.rosters);
  else if (data?.rosters && typeof data.rosters === "object") rosterGroups.push(...Object.values(data.rosters));

  rosterGroups.forEach((r: any) => {
    const side = sideForTeam(r.team);
    const athletes = r.athletes || r.roster || r.players || r.statistics?.[0]?.athletes || [];
    mergePlayers(side, athletes, r.formation);
  });

  return lineups;
};

const inferTeam = (lowerText: string, homeTeamName: string, awayTeamName: string) => {
  const home = normalizeName(homeTeamName);
  const away = normalizeName(awayTeamName);

  if (home && lowerText.includes(home)) return "home";
  if (away && lowerText.includes(away)) return "away";
  return "";
};

const parseCommentaryEvents = (commentary: any[], homeId: string, awayId: string, homeTeamName: string, awayTeamName: string) => {
  if (!Array.isArray(commentary) || commentary.length === 0) return [];

  const seen = new Set<string>();

  const parsed = commentary
    .map((c: any, index: number) => {
      const text = c.text || c.headline || "";
      const lowerText = String(text).toLowerCase();
      const metaType = String(c.play?.type?.text || c.type?.text || "").toLowerCase();
      const time = c.time?.displayValue || c.clock?.displayValue || "0'";

      let type = "attempt";
      let actionName = "Match Update";

      if (
        lowerText.includes("var") ||
        lowerText.includes("overturned") ||
        lowerText.includes("disallowed") ||
        lowerText.includes("no goal") ||
        metaType.includes("var")
      ) {
        type = "var_overturn";
        actionName = "VAR Decision";
      } else if (lowerText.includes("penalty awarded") || metaType === "penalty awarded") {
        type = "penalty_awarded";
        actionName = "Penalty Awarded";
      } else if (
        lowerText.includes("penalty saved") ||
        lowerText.includes("penalty missed") ||
        metaType === "penalty saved" ||
        metaType === "penalty missed"
      ) {
        type = "penalty_missed";
        actionName = "Penalty Missed";
      } else if (
        metaType === "goal" ||
        lowerText.includes("goal!") ||
        lowerText.includes("scores!") ||
        lowerText.includes("own goal by") ||
        (lowerText.includes("goal") && /\d+/.test(lowerText)) ||
        (lowerText.includes("penalty") && lowerText.includes("scored"))
      ) {
        type = "goal";
        actionName = lowerText.includes("own goal") ? "Own Goal" : lowerText.includes("penalty") ? "Penalty Goal" : "Goal";
      } else if (lowerText.includes("red card") || metaType.includes("red")) {
        type = "red-card";
        actionName = "Red Card";
      } else if (lowerText.includes("card") || metaType.includes("card")) {
        type = "card";
        actionName = "Yellow Card";
      } else if (lowerText.includes("substitution") || lowerText.includes("subbed") || metaType.includes("substitution")) {
        type = "sub";
        actionName = "Substitution";
      } else if (lowerText.includes("penalty")) {
        type = "penalty_awarded";
        actionName = "Penalty Check";
      }

      const participants = c.play?.participants || [];
      const first = participants[0];
      let player = first?.athlete?.displayName || first?.athlete?.shortDisplayName || "";
      let team = "";

      const participantTeamId = String(first?.team?.id || "");
      if (participantTeamId === String(homeId)) team = "home";
      else if (participantTeamId === String(awayId)) team = "away";

      if (!team) team = inferTeam(lowerText, homeTeamName, awayTeamName);

      if (type === "sub" && participants.length > 1) {
        const p1 = participants[0]?.athlete?.displayName || "";
        const p2 = participants[1]?.athlete?.displayName || "";
        player = p1 && p2 ? `${p1} (In) / ${p2} (Out)` : player;
      }

      if (!player || player.length > 85) {
        if (type === "goal") player = "Goal Confirmed";
        else if (type === "var_overturn") player = "Goal Disallowed";
        else if (type === "penalty_awarded") player = "Penalty Check";
        else if (type === "penalty_missed") player = "Penalty Missed";
        else if (type === "attempt") player = "Shot on Target";
        else if (type === "card" || type === "red-card") player = "Booking";
        else if (type === "sub") player = "Tactical Change";
        else player = "Match Update";
      }

      const id = c.id || `${index}-${time}-${type}`;
      if (seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        time,
        type,
        text: actionName,
        player,
        team
      };
    })
    .filter(Boolean);

  return parsed.reverse();
};

const extractStatus = (header: any, homeComp: any, awayComp: any) => {
  const state = String(header?.status?.type?.state || "").toLowerCase();
  const description = header?.status?.type?.description || "";
  const clock = header?.status?.displayClock || "0:00";

  let status = "SCHEDULED";

  if (state === "in") status = "LIVE";
  if (state === "post") status = "FT";
  if (isHalftime(description, clock)) status = "HT";

  if (
    status === "FT" &&
    (safeNullableInt(homeComp?.shootoutScore) !== null || safeNullableInt(awayComp?.shootoutScore) !== null)
  ) {
    status = "PEN";
  }

  return status;
};

async function fetchJsonWithFallback(urls: string[]) {
  let lastError: any = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });

      if (res.ok) return await res.json();

      lastError = new Error(`ESPN fetch failed: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("ESPN fetch failed");
}

export async function fetchEspnLive(leagueCode: string, dates?: string) {
  const params = new URLSearchParams();
  if (dates) params.set("dates", dates);
  params.set("_", String(Date.now()));

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?${params.toString()}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !data.events) return [];

    return data.events.map((e: any) => {
      const comp = e.competitions?.[0];
      const homeComp = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const awayComp = comp?.competitors?.find((c: any) => c.homeAway === "away");
      const noteText = extractNotes(comp);

      let stage = comp?.type?.text || comp?.type?.abbreviation || "Regular Season";
      let matchGroup = comp?.group?.name || comp?.group?.abbreviation || null;
      let matchType = "REGULAR_SEASON";

      if (noteText.includes("final")) {
        stage = "Final";
        matchType = "FINAL";
      } else if (noteText.includes("semi")) {
        stage = "Semi-final";
        matchType = "SEMI_FINAL";
      } else if (noteText.includes("quarter")) {
        stage = "Quarter-final";
        matchType = "QUARTER_FINAL";
      } else if (noteText.includes("group") || matchGroup) {
        stage = "Group Stage";
        matchType = "GROUP_STAGE";
      }

      const state = e.status?.type?.state;
      const clock = e.status?.type?.description === "Halftime" ? "HT" : (e.status?.displayClock || "0'");

      let status = "SCHEDULED";
      if (state === "in") status = "LIVE";
      if (state === "post") status = "FT";
      if (clock === "HT") status = "HT";

      if (
        status === "FT" &&
        (safeNullableInt(homeComp?.shootoutScore) !== null || safeNullableInt(awayComp?.shootoutScore) !== null)
      ) {
        status = "PEN";
      }

      return {
        espn_id: String(e.id),
        status,
        clock,
        home_team: homeComp?.team?.displayName || "Home Team",
        away_team: awayComp?.team?.displayName || "Away Team",
        home_score: safeInt(homeComp?.score),
        away_score: safeInt(awayComp?.score),
        startTime: e.date ? new Date(e.date).getTime() : 0,
        date: e.date,
        league: "",
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
  const encodedGameId = encodeURIComponent(gameId);

  const urls = [
    `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodedGameId}&_=${Date.now()}`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodedGameId}&_=${Date.now()}`
  ];

  try {
    const data = await fetchJsonWithFallback(urls);
    const header = data?.header;
    const competition = header?.competitions?.[0];

    if (!header || !competition) return null;

    const homeCompetitor = competition.competitors?.find((c: any) => c.homeAway === "home");
    const awayCompetitor = competition.competitors?.find((c: any) => c.homeAway === "away");

    const homeId = String(homeCompetitor?.team?.id || "");
    const awayId = String(awayCompetitor?.team?.id || "");
    const homeTeamName = safeText(homeCompetitor?.team?.displayName || homeCompetitor?.team?.name || "");
    const awayTeamName = safeText(awayCompetitor?.team?.displayName || awayCompetitor?.team?.name || "");

    const status = extractStatus(header, homeCompetitor, awayCompetitor);
    const displayClock = status === "HT" ? "HT" : (header.status?.displayClock || "0:00");

    const context = extractContext(data, header);
    const lineups = extractLineups(data, homeId, homeTeamName, awayTeamName);
    const events = parseCommentaryEvents(data.commentary, homeId, awayId, homeTeamName, awayTeamName);

    return {
      events,
      match_events: events,
      stats: extractStats(data, homeId, homeTeamName, awayTeamName),
      lineups,
      venue: data.gameInfo?.venue?.fullName || null,
      attendance: data.gameInfo?.attendance || null,
      referees: data.gameInfo?.officials?.map((o: any) => o.displayName || o.fullName).filter(Boolean) || [],
      predictor: data?.predictor
        ? {
            home: safeFloat(data.predictor.homeTeam?.gameProjection),
            away: safeFloat(data.predictor.awayTeam?.gameProjection),
            draw: safeFloat(data.predictor.draw?.gameProjection)
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
      status,
      home_score: scoreFromCompetitor(homeCompetitor),
      away_score: scoreFromCompetitor(awayCompetitor),
      displayClock
    };
  } catch (err) {
    console.error("ESPN Fetch Details Error:", err);
    return null;
  }
}