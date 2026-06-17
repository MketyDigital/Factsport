const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-espn-id, x-match-id"
};

const TERMINAL_STATUSES = new Set([
  "FT",
  "FINISHED",
  "POST",
  "ENDED",
  "FULL_TIME",
  "AET",
  "PEN",
  "AWARDED",
  "ABD"
]);

const LIVE_STATUSES = new Set([
  "LIVE",
  "HT",
  "HALFTIME",
  "IN_PLAY",
  "IN",
  "1H",
  "2H",
  "ET",
  "EXTRA_TIME",
  "P",
  "PENALTIES"
]);

const PRE_STATUSES = new Set([
  "SCHEDULED",
  "PRE",
  "TIMED",
  "NS",
  "UPCOMING",
  "TBD"
]);

const json = (body, init = {}) => {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      ...corsHeaders,
      ...(init.headers || {})
    }
  });
};

const safeInt = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = parseInt(String(value).replace("%", ""), 10);
  return Number.isFinite(n) ? n : 0;
};

const safeFloat = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = parseFloat(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

const safeText = (value) => {
  if (!value) return "";
  return String(value).trim();
};

const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
};

const stableStringify = (value) => {
  try {
    return JSON.stringify(value || null);
  } catch {
    return "";
  }
};

const normalizeStatus = (rawStatus, clock = "") => {
  const status = String(rawStatus || "pre").toLowerCase();

  if (status === "in") return "LIVE";
  if (status === "post") return "FT";
  if (status === "pre" || status === "timed") return "SCHEDULED";
  if (clock === "HT" || String(clock).toUpperCase() === "HT") return "HT";
  if (status === "halftime") return "HT";

  return rawStatus ? String(rawStatus).toUpperCase() : "SCHEDULED";
};

const parseClock = (header) => {
  const statusDescription = header?.status?.type?.description || "";
  const currentStatus = header?.status?.type?.state || "pre";
  let clock = statusDescription === "Halftime" ? "HT" : safeText(header?.status?.displayClock || "0'");

  if (currentStatus === "in" && header?.competitions?.[0]?.status?.type?.description !== "Halftime" && !clock) {
    clock = "0'";
  }

  return clock;
};

const extractNotes = (competition) => {
  const notes = competition?.notes || [];
  if (!Array.isArray(notes)) return "";
  return notes.map((n) => [n.headline, n.type, n.text].filter(Boolean).join(" ")).join(" | ").toLowerCase();
};

const extractGroupSummary = (data) => {
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
        teams: table.slice(0, 8).map((entry) => ({
          name: entry?.team?.name || entry?.team?.displayName || entry?.team || "Unknown",
          points: safeInt(entry?.points ?? entry?.value),
          played: safeInt(entry?.playedGames ?? entry?.played ?? entry?.stats?.find?.((s) => s.name === "Games Played")?.value),
          goalDifference: entry?.goalDifference ?? entry?.goal_difference ?? null
        }))
      });
    }

    if (summary.length) return summary;
  }

  return [];
};

const extractContext = (data, header) => {
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

const extractStats = (data, homeId) => {
  const boxscore = data?.boxscore;
  const homeComp = data?.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "home");
  const awayComp = data?.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === "away");

  const stats = {
    home: {},
    away: {},
    home_penalties: homeComp?.shootoutScore !== null && homeComp?.shootoutScore !== undefined ? safeInt(homeComp.shootoutScore) : null,
    away_penalties: awayComp?.shootoutScore !== null && awayComp?.shootoutScore !== undefined ? safeInt(awayComp.shootoutScore) : null,
    home_ht: homeComp?.linescores?.[0]?.value !== null && homeComp?.linescores?.[0]?.value !== undefined ? safeInt(homeComp.linescores[0].value) : null,
    away_ht: awayComp?.linescores?.[0]?.value !== null && awayComp?.linescores?.[0]?.value !== undefined ? safeInt(awayComp.linescores[0].value) : null,
    aggregate: homeComp?.series?.summary || awayComp?.series?.summary || data?.header?.series?.summary || null
  };

  const statMap = {
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
    boxscore.teams.forEach((teamStats) => {
      const side = String(teamStats?.team?.id) === String(homeId) ? "home" : "away";

      if (!teamStats?.statistics || !Array.isArray(teamStats.statistics)) return;

      teamStats.statistics.forEach((stat) => {
        const key = statMap[stat.name] || statMap[String(stat.name).trim()] || stat.name;
        if (!key) return;

        stats[side][key] = stat.displayValue !== undefined && stat.displayValue !== null
          ? stat.displayValue
          : stat.value;
      });
    });
  }

  return stats;
};

const extractLineups = (data, homeId, homeTeamName, awayTeamName) => {
  const boxscore = data?.boxscore || {};
  const lineups = {
    home: [],
    away: [],
    formations: {
      home: null,
      away: null
    }
  };

  const rosterCandidates = [
    boxscore?.rosters,
    boxscore?.players,
    data?.rosters
  ].filter(Boolean);

  const addRoster = (roster) => {
    if (!Array.isArray(roster)) return;

    roster.forEach((r) => {
      const side = String(r?.team?.id) === String(homeId) ? "home" : "away";
      const teamName = side === "home" ? homeTeamName : awayTeamName;

      if (r?.formation) {
        lineups.formations[side] = r.formation;
      }

      const athletes = r?.athletes || r?.roster || r?.statistics?.[0]?.athletes || [];

      if (!Array.isArray(athletes)) return;

      lineups[side] = athletes.map((p) => ({
        name: p?.athlete?.displayName || p?.athlete?.fullName || p?.displayName || p?.shortDisplayName || "",
        number: p?.jersey || p?.uniform || "",
        position: p?.position?.abbreviation || p?.position?.name || "P",
        positionName: p?.position?.name || "",
        is_starter: Boolean(p?.starter),
        team: teamName
      }));
    });
  };

  rosterCandidates.forEach(addRoster);

  if (!lineups.home.length && !lineups.away.length && boxscore?.teams && Array.isArray(boxscore.teams)) {
    boxscore.teams.forEach((t) => {
      const side = String(t?.team?.id) === String(homeId) ? "home" : "away";
      const teamName = side === "home" ? homeTeamName : awayTeamName;

      if (Array.isArray(t?.roster)) {
        lineups[side] = t.roster.map((p) => ({
          name: p?.athlete?.displayName || p?.athlete?.fullName || p?.displayName || "",
          number: p?.jersey || p?.uniform || "",
          position: p?.position?.abbreviation || p?.position?.name || "P",
          positionName: p?.position?.name || "",
          is_starter: Boolean(p?.starter),
          team: teamName
        }));
      }
    });
  }

  return lineups;
};

const parseCommentaryEvents = (commentary, rosterDict) => {
  if (!Array.isArray(commentary) || commentary.length === 0) return [];

  const parsed = commentary
    .filter((c) => {
      const text = String(c?.text || "").toLowerCase();
      const metaType = String(c?.play?.type?.text || "").toLowerCase();

      return (
        text.includes("goal") ||
        text.includes("penalty") ||
        text.includes("card") ||
        text.includes("substitution") ||
        text.includes("subbed") ||
        text.includes("var ") ||
        text.includes("overturned") ||
        text.includes("attempt") ||
        metaType.includes("goal") ||
        metaType.includes("card") ||
        metaType.includes("penalty") ||
        metaType.includes("shot") ||
        metaType.includes("substitution")
      );
    })
    .map((c) => {
      const text = c?.text || "";
      const lowerText = text.toLowerCase();
      const time = c?.time?.displayValue || "0'";
      const metaType = String(c?.play?.type?.text || "").toLowerCase();

      let type = "attempt";
      let actionName = "Match Update";
      let player = "";
      let matchedPlayerName = "";
      let matchedTeamName = "";
      let matchedSide = "";

      if (lowerText.includes("var decision") || lowerText.includes("overturned") || lowerText.includes("disallowed") || lowerText.includes("no goal") || metaType.includes("var")) {
        type = "var_overturn";
        actionName = "VAR Decision";
      } else if (lowerText.includes("penalty conceded")) {
        type = "penalty_awarded";
        actionName = "Penalty Conceded";
      } else if (lowerText.includes("penalty awarded")) {
        type = "penalty_awarded";
        actionName = "Penalty Awarded";
      } else if (lowerText.includes("penalty") && (lowerText.includes("check") || lowerText.includes("var"))) {
        type = "var_overturn";
        actionName = "VAR Penalty Check";
      } else if ((lowerText.includes("penalty") && (lowerText.includes("saved") || lowerText.includes("missed"))) || metaType === "penalty missed" || metaType === "penalty saved") {
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
        actionName = lowerText.includes("own goal") ? "Own Goal" : (lowerText.includes("penalty") ? "Penalty Goal" : "Goal");
      } else if (lowerText.includes("card") || metaType.includes("card")) {
        type = lowerText.includes("red") ? "red-card" : "card";
        actionName = lowerText.includes("red") ? "Red Card" : "Yellow Card";
      } else if (lowerText.includes("substitution") || lowerText.includes("subbed") || metaType.includes("substitution")) {
        type = "sub";
        actionName = "Substitution";
      } else {
        type = "attempt";
        actionName = lowerText.includes("saved") ? "Shot Saved" : "Shot Missed";
      }

      const participants = c?.play?.participants || [];

      if (participants.length > 0) {
        matchedPlayerName = participants[0]?.athlete?.displayName || "";
        const exactMatch = rosterDict.find((r) => r.name === matchedPlayerName);

        if (exactMatch) {
          matchedTeamName = exactMatch.teamName;
          matchedSide = exactMatch.side;
        }

        if (type === "sub" && participants.length > 1) {
          const p1 = participants[0]?.athlete?.displayName || "";
          const p2 = participants[1]?.athlete?.displayName || "";
          const teamMatch = rosterDict.find((r) => r.name === p1);

          if (p1 && p2) {
            player = teamMatch ? `${p1} (In) / ${p2} (Out) (${teamMatch.teamName})` : `${p1} (In) / ${p2} (Out)`;
            if (teamMatch) matchedSide = teamMatch.side;
          }
        }
      }

      if (!player) {
        if (type === "sub") {
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

      if (type === "goal" && lowerText.includes("assisted by")) {
        const assistIndex = lowerText.indexOf("assisted by");
        const assistText = text.substring(assistIndex);
        const assistMatch = rosterDict.find((r) => assistText.includes(r.name) && r.name !== matchedPlayerName);

        if (assistMatch) {
          player = `${player || "Goal"} (Assist: ${assistMatch.name})`;
        } else {
          const regMatch = text.match(/Assisted by (.*?)(?: with|\.)/i);
          if (regMatch) player = `${player || "Goal"} (Assist: ${regMatch[1].trim()})`;
        }
      }

      if (!player || player.trim() === "" || player.length > 85 || player.toLowerCase().includes("unknown")) {
        if (type === "goal") player = "Goal Confirmed";
        else if (type === "var_overturn") player = "Goal Disallowed";
        else if (type === "penalty_awarded") player = "Penalty Check";
        else if (type === "penalty_missed") player = "Penalty Missed";
        else if (type === "attempt") player = "Shot on Target";
        else if (type === "card" || type === "red-card") player = "Booking";
        else if (type === "sub") player = "Tactical Change";
        else player = "Match Update";
      }

      return {
        id: makeId(),
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

const buildEspnPayload = (data) => {
  const header = data?.header;
  const competition = header?.competitions?.[0];

  if (!competition) {
    throw new Error("Match data unavailable");
  }

  const homeComp = competition.competitors?.find((c) => c.homeAway === "home");
  const awayComp = competition.competitors?.find((c) => c.homeAway === "away");
  const homeTeam = homeComp?.team || {};
  const awayTeam = awayComp?.team || {};
  const homeId = String(homeTeam?.id || "");
  const homeTeamName = homeTeam?.displayName || "Home Team";
  const awayTeamName = awayTeam?.displayName || "Away Team";
  const currentStatus = header?.status?.type?.state || "pre";
  let currentClock = parseClock(header);

  if (data?.commentary && data.commentary.length > 0 && currentClock !== "HT" && currentStatus === "in") {
    const latestTimeStr = data.commentary[0]?.time?.displayValue;
    if (latestTimeStr && latestTimeStr.includes("'")) {
      const cleanClock = currentClock.replace(/:.*/, "");
      const clockNum = safeInt(cleanClock.replace(/\D/g, ""));
      const eventNum = safeInt(latestTimeStr.replace(/\D/g, ""));

      if (eventNum > clockNum) {
        currentClock = latestTimeStr;
      } else if (eventNum === clockNum && latestTimeStr.includes("+") && !currentClock.includes("+")) {
        currentClock = latestTimeStr;
      }
    }
  }

  let mappedStatus = "SCHEDULED";
  if (currentStatus === "in") mappedStatus = "LIVE";
  if (currentStatus === "post") mappedStatus = "FT";
  if (currentClock === "HT") mappedStatus = "HT";
  if (mappedStatus === "FT" && (homeComp?.shootoutScore !== null || awayComp?.shootoutScore !== null)) mappedStatus = "PEN";

  const rosterDict = [];
  const lineups = extractLineups(data, homeId, homeTeamName, awayTeamName);

  ["home", "away"].forEach((side) => {
    const teamName = side === "home" ? homeTeamName : awayTeamName;
    if (Array.isArray(lineups[side])) {
      lineups[side].forEach((p) => {
        if (p?.name) rosterDict.push({ name: p.name, side, teamName });
      });
    }
  });

  rosterDict.sort((a, b) => b.name.length - a.name.length);

  const context = extractContext(data, header);

  return {
    espn_id: String(data?.header?.id || data?.event?.id || ""),
    status: mappedStatus,
    home_score: safeInt(homeComp?.score),
    away_score: safeInt(awayComp?.score),
    displayClock: currentClock,
    stats: extractStats(data, homeId),
    lineups,
    match_events: parseCommentaryEvents(data?.commentary, rosterDict),
    events: parseCommentaryEvents(data?.commentary, rosterDict),
    venue: data?.gameInfo?.venue?.fullName || null,
    attendance: data?.gameInfo?.attendance || null,
    referees: data?.gameInfo?.officials?.map((o) => o.displayName || o.fullName).filter(Boolean) || [],
    predictor: data?.predictor
      ? {
          home: safeFloat(data.predictor.homeTeam?.gameProjection || 0),
          away: safeFloat(data.predictor.awayTeam?.gameProjection || 0),
          draw: safeFloat(data.predictor.draw?.gameProjection || 0)
        }
      : null,
    home_team: homeTeamName,
    away_team: awayTeamName,
    home_logo: homeTeam?.logo || homeTeam?.links?.[0]?.href || null,
    away_logo: awayTeam?.logo || awayTeam?.links?.[0]?.href || null,
    stage: context.stage,
    match_group: context.match_group,
    match_type: context.match_type,
    round: context.round,
    group_summary: context.group_summary,
    knockout: context.knockout,
    final: context.final
  };
};

async function fetchJsonWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache"
        }
      });

      if (res.ok) return await res.json();

      lastError = new Error(`ESPN fetch failed: ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("ESPN fetch failed");
}

async function fetchEspnDetails(env, gameId) {
  const encodedGameId = encodeURIComponent(gameId);
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodedGameId}&_=${Date.now()}`,
    `https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodedGameId}&_=${Date.now()}`
  ];

  const data = await fetchJsonWithFallback(urls);
  return buildEspnPayload(data);
}

async function enforceRateLimit(request, env) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return true;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const minute = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${minute}`;
  const current = Number(await kv.get(key) || "0");
  const limit = Number(env.RATE_LIMIT_PER_MIN || 120);

  if (current >= limit) return false;

  await kv.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

const handleMotm = async (request, env, url) => {
  if (!env.DB) {
    return json({ error: "MOTM storage is not configured." }, { status: 500 });
  }

  if (request.method === "GET") {
    const id = url.searchParams.get("matchId") || url.searchParams.get("match_id") || "";
    const status = String(url.searchParams.get("status") || "").toUpperCase();

    if (!id) return json({ error: "Missing matchId" }, { status: 400 });

    const isFinished = TERMINAL_STATUSES.has(status);
    const motmCacheTime = isFinished ? 3600 : 10;
    const cacheKey = new Request(url.toString(), request);
    const cachedResponse = await caches.default.match(cacheKey);
    if (cachedResponse) return cachedResponse;

    try {
      const { results } = await env.DB.prepare(
        "SELECT player_name, votes FROM motm_votes WHERE match_id = ? ORDER BY votes DESC, player_name ASC LIMIT 10"
      ).bind(id).all();

      const response = json(results, {
        headers: {
          "Cache-Control": `public, s-maxage=${motmCacheTime}, max-age=${motmCacheTime}`
        }
      });

      request.ctx?.waitUntil?.(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch (e) {
      return json({ error: e.message }, { status: 500 });
    }
  }

  if (request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id = String(body.matchId || body.match_id || body.id || "").trim();
    const playerName = String(body.playerName || body.player_name || "").trim().slice(0, 80);

    if (!id || !playerName) {
      return json({ error: "Missing matchId or playerName" }, { status: 400 });
    }

    try {
      await env.DB.prepare(`
        INSERT INTO motm_votes (match_id, player_name, votes, updated_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT (match_id, player_name) DO UPDATE SET votes = motm_votes.votes + 1, updated_at = excluded.updated_at
      `).bind(id, playerName, Date.now()).run();

      return json({ success: true });
    } catch (e) {
      return json({ error: e.message }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

const handleEspnFrontend = async (request, env, url) => {
  const espnId = url.searchParams.get("espn_id") || request.headers.get("x-espn-id");
  if (!espnId) return json({ error: "Missing espn_id" }, { status: 400 });

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const cleanCacheUrl = new URL(url.origin + url.pathname + "?espn_id=" + encodeURIComponent(espnId));
  const cacheKey = new Request(cleanCacheUrl.toString(), request);
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) return cachedResponse;

  try {
    const payload = await fetchEspnDetails(env, espnId);

    let cacheSeconds = 60;
    if (payload.status === "LIVE" || payload.status === "HT") cacheSeconds = Number(env.LIVE_CACHE_SECONDS || 2);
    if (TERMINAL_STATUSES.has(payload.status)) cacheSeconds = 3600;

    const response = json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${cacheSeconds}, max-age=${cacheSeconds}`
      }
    });

    request.ctx?.waitUntil?.(caches.default.put(cacheKey, response.clone()));
    return response;
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
};

const supabaseBase = (env) => (env.SUPABASE_URL || "").replace(/\/$/, "");

const supabaseFetch = async (env, path, init = {}) => {
  const base = supabaseBase(env);
  if (!base || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured on this worker.");
  }

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }

  return res.json();
};

const activeSelectColumns = [
  "id",
  "espn_id",
  "status",
  "home_score",
  "away_score",
  "displayClock",
  "match_events",
  "events",
  "stats",
  "lineups",
  "venue",
  "referees",
  "predictor",
  "stage",
  "match_group",
  "match_type",
  "round",
  "group_summary",
  "knockout",
  "final",
  "home_team",
  "away_team",
  "league",
  "match_date",
  "home_logo",
  "away_logo",
  "updated_at",
  "last_live_sync_at"
].join(",");

const getActiveMatches = async (env) => {
  const now = Date.now();

  const lookBackDays = Number(env.LIVE_SYNC_LOOKBACK_DAYS || 1);
  const lookForwardDays = Number(env.LIVE_SYNC_LOOKAHEAD_DAYS || 2);

  const lookBack = new Date(now - lookBackDays * 24 * 60 * 60 * 1000).toISOString();
  const lookForward = new Date(now + lookForwardDays * 24 * 60 * 60 * 1000).toISOString();

  return supabaseFetch(
    env,
    `/rest/v1/matches?select=${encodeURIComponent(activeSelectColumns)}&match_date=gte.${encodeURIComponent(lookBack)}&match_date=lte.${encodeURIComponent(lookForward)}`
  );
};

const patchMatch = async (env, id, payload) => {
  return supabaseFetch(
    env,
    `/rest/v1/matches?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    }
  );
};

const shouldFetchForMatch = (dbMatch, espnPayload, env = {}) => {
  const status = String(dbMatch.status || "").toUpperCase();
  const nextStatus = String(espnPayload.status || "").toUpperCase();

  const kickMs = Date.parse(dbMatch.match_date);
  const minutesSinceKick = Number.isFinite(kickMs)
    ? (Date.now() - kickMs) / 60000
    : 999999;

  const staleMinutes = Number(env.LIVE_SYNC_STALE_MINUTES || 90);

  const dbScoresPresent =
    Number.isFinite(Number(dbMatch.home_score)) &&
    Number.isFinite(Number(dbMatch.away_score));

  const scoresChanged =
    Number(dbMatch.home_score || 0) !== Number(espnPayload.home_score || 0) ||
    Number(dbMatch.away_score || 0) !== Number(espnPayload.away_score || 0);

  const eventsChanged =
    Array.isArray(espnPayload.match_events) &&
    espnPayload.match_events.length > 0 &&
    stableStringify(espnPayload.match_events) !== stableStringify(dbMatch.match_events || []);

  const hasLineups =
    espnPayload.lineups?.home?.length > 0 ||
    espnPayload.lineups?.away?.length > 0;

  const lineupsChanged =
    hasLineups &&
    stableStringify(espnPayload.lineups) !== stableStringify(dbMatch.lineups || {});

  // ESPN says live: always fetch.
  if (LIVE_STATUSES.has(nextStatus)) return true;

  // ESPN says terminal: fetch if DB is not terminal, scores missing/changed, or rich data missing.
  if (TERMINAL_STATUSES.has(nextStatus)) {
    if (!TERMINAL_STATUSES.has(status)) return true;
    if (!dbScoresPresent) return true;
    if (scoresChanged) return true;
    if (eventsChanged) return true;
    if (lineupsChanged) return true;
    return false;
  }

  // DB already says live: keep fetching.
  if (LIVE_STATUSES.has(status)) return true;

  // Scheduled/pre window.
  if (PRE_STATUSES.has(status) || status === "") {
    if (minutesSinceKick >= -150 && minutesSinceKick <= 150) return true;

    // Crucial fix: stale scheduled matches are fetched again.
    if (minutesSinceKick > staleMinutes) return true;

    return false;
  }

  // Unknown non-terminal status with rich data changes.
  if (eventsChanged) return true;
  if (lineupsChanged) return true;

  return false;
};

const buildUpdatePayload = (oldMatch, espnPayload) => {
  const payload = {
    updated_at: new Date().toISOString(),
    last_live_sync_at: new Date().toISOString(),
    status: espnPayload.status,
    home_score: espnPayload.home_score,
    away_score: espnPayload.away_score,
    displayClock: espnPayload.displayClock,
    match_events: espnPayload.match_events || espnPayload.events || [],
    events: espnPayload.events || espnPayload.match_events || [],
    stats: espnPayload.stats || { home: {}, away: {} },
    lineups: espnPayload.lineups || { home: [], away: [], formations: { home: null, away: null } },
    venue: espnPayload.venue,
    referees: espnPayload.referees,
    predictor: espnPayload.predictor || null,
    stage: espnPayload.stage,
    match_group: espnPayload.match_group,
    match_type: espnPayload.match_type,
    round: espnPayload.round,
    group_summary: espnPayload.group_summary || [],
    knockout: Boolean(espnPayload.knockout),
    final: Boolean(espnPayload.final)
  };

  if (espnPayload.home_logo) payload.home_logo = espnPayload.home_logo;
  if (espnPayload.away_logo) payload.away_logo = espnPayload.away_logo;

  return payload;
};

const dispatchSocial = async (env, oldMatch, newMatch) => {
  const frontendUrl = (env.FRONTEND_URL || "https://factsport.com").replace(/\/$/, "");
  const oldStatus = String(oldMatch.status || "").toUpperCase();
  const newStatus = String(newMatch.status || "").toUpperCase();

  const statusChangedToFT = TERMINAL_STATUSES.has(newStatus) && !TERMINAL_STATUSES.has(oldStatus);
  const scoresChanged = Number(newMatch.home_score) !== Number(oldMatch.home_score) || Number(newMatch.away_score) !== Number(oldMatch.away_score);
  const lineupsAnnounced = !oldMatch.lineups?.home?.length && newMatch.lineups?.home?.length >= 11;

  if (!statusChangedToFT && !scoresChanged && !lineupsAnnounced) return;

  fetch(`${frontendUrl}/api/social`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.CRON_KEY || ""}`
    },
    body: JSON.stringify({
      record: newMatch,
      old_record: oldMatch
    })
  }).catch(() => {});
};

const runLiveSync = async (env) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { message: "Supabase service role is not configured." };
  }

  const activeMatches = await getActiveMatches(env);
  const logs = [];
  let updates = 0;

  const pool = [];
  const concurrency = Number(env.LIVE_SYNC_CONCURRENCY || 3);

  for (const dbMatch of activeMatches || []) {
    if (!dbMatch.espn_id) continue;

    const dbStatus = String(dbMatch.status || "").toUpperCase();
    const dbScoresPresent =
      Number.isFinite(Number(dbMatch.home_score)) &&
      Number.isFinite(Number(dbMatch.away_score));

    // Skip terminal matches only when scores and core rich data are already present.
    if (
      TERMINAL_STATUSES.has(dbStatus) &&
      dbScoresPresent &&
      Array.isArray(dbMatch.match_events) &&
      dbMatch.match_events.length > 0 &&
      dbMatch.lineups?.home?.length > 0
    ) {
      continue;
    }

    const task = (async () => {
      try {
        const espnPayload = await fetchEspnDetails(env, dbMatch.espn_id);
        if (!shouldFetchForMatch(dbMatch, espnPayload, env)) return;

        const payload = buildUpdatePayload(dbMatch, espnPayload);
        await patchMatch(env, dbMatch.id, payload);

        const newMatch = { ...dbMatch, ...payload };
        dispatchSocial(env, dbMatch, newMatch).catch(() => {});

        updates++;
        logs.push(`Updated ${dbMatch.home_team} vs ${dbMatch.away_team}`);
      } catch (e) {
        logs.push(`Failed ${dbMatch.espn_id}: ${e.message}`);
      }
    })();

    pool.push(task);

    if (pool.length >= concurrency) {
      await Promise.all(pool.splice(0, pool.length));
    }
  }

  await Promise.all(pool);

  return {
    success: true,
    updates,
    logs
  };
};

const handleLiveSync = async (request, env) => {
  const key = new URL(request.url).searchParams.get("key") || request.headers.get("Authorization")?.replace("Bearer ", "");
  if (key !== env.CRON_KEY) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLiveSync(env);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const limited = await enforceRateLimit(request, env);
    if (!limited) {
      return json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const wrappedRequest = new Proxy(request, {
      get(target, prop) {
        if (prop === "ctx") return ctx;
        return target[prop];
      }
    });

    if (url.pathname === "/api/motm") {
      return handleMotm(wrappedRequest, env, url);
    }

    if (url.pathname === "/api/live-sync") {
      return handleLiveSync(wrappedRequest, env);
    }

    return handleEspnFrontend(wrappedRequest, env, url);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runLiveSync(env).catch((e) => {
      console.error("Scheduled live sync failed", e);
    }));
  }
};
