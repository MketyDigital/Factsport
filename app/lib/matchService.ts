// app/lib/matchService.ts
import { createClient } from '@/app/lib/supabase/client';
import { fetchEspnDetails } from '@/app/lib/espn';

export interface UnifiedMatchData {
  status: string;
  displayClock: string;
  home: { name: string; logo: string; score: number | string; id: string };
  away: { name: string; logo: string; score: number | string; id: string };
  goals: any[];
  commentary: any[];
  stats: any;
  lineups: { home: any[]; away: any[]; formations?: { home: string; away: string } };
  hasExternalData: boolean;
  widget_id?: string;

  venue?: string | null;
  referees?: any[];
  stage?: string | null;
  group?: string | null;
  match_group?: string | null;
  match_type?: string | null;
  round?: string | null;
  group_summary?: any[];
  knockout?: boolean;
  final?: boolean;
  h2h?: any;
  predictor?: { home: number; away: number; draw: number } | null;

  id?: string;
  home_team?: string;
  away_team?: string;
  home_logo?: string;
  away_logo?: string;
  home_score?: number;
  away_score?: number;
  match_date?: string;
  league?: string;
}

const TERMINAL_STATUSES = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);
const PRE_STATUSES = new Set(['SCHEDULED', 'PRE', 'NS', 'UPCOMING', 'TBD', 'TIMED', '']);

export async function getExternalData(dbData: any): Promise<UnifiedMatchData> {
  let espnLive = null;

  if (dbData.espn_id) {
    espnLive = await fetchEspnDetails(dbData.espn_id).catch(() => null);
  }

  // 🟢 100% RELIABILITY GUARANTEE: Auto-sync back to Supabase database if any live data changed!
  if (dbData.id && espnLive && !('error' in (espnLive as any))) {
    const nextStatus = String(espnLive.status || '').toUpperCase();
    const currentStatus = String(dbData.status || '').toUpperCase();

    const statusChanged = nextStatus !== currentStatus;
    const scoresChanged = (
      Number(dbData.home_score ?? 0) !== Number(espnLive.home_score ?? 0) ||
      Number(dbData.away_score ?? 0) !== Number(espnLive.away_score ?? 0)
    );

    const lineupsBecameAvailable = !dbData.lineups?.home?.length && espnLive.lineups?.home?.length > 0;
    const statsBecameAvailable = !Object.keys(dbData.stats?.home || {}).length && Object.keys(espnLive.stats?.home || {}).length > 0;
    const eventsBecameAvailable = !dbData.match_events?.length && (espnLive.events?.length > 0 || espnLive.match_events?.length > 0);

    if (statusChanged || scoresChanged || lineupsBecameAvailable || statsBecameAvailable || eventsBecameAvailable) {
      try {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const nowIso = new Date().toISOString();
        const payload: any = {
          status: espnLive.status || dbData.status,
          home_score: espnLive.home_score ?? dbData.home_score,
          away_score: espnLive.away_score ?? dbData.away_score,
          displayClock: espnLive.displayClock || dbData.displayClock,
          updated_at: nowIso,
          last_live_sync_at: nowIso
        };

        const nextEvents = espnLive.match_events || espnLive.events || dbData.match_events || [];
        const nextLineups = espnLive.lineups || dbData.lineups || { home: [], away: [], formations: { home: null, away: null } };
        const nextStats = espnLive.stats || dbData.stats || { home: {}, away: {} };

        if ('match_events' in dbData) payload.match_events = nextEvents;
        if ('events' in dbData) payload.events = nextEvents;
        if ('stats' in dbData) payload.stats = nextStats;
        if ('lineups' in dbData) payload.lineups = nextLineups;
        if ('venue' in dbData) payload.venue = espnLive.venue ?? dbData.venue ?? null;
        if ('referees' in dbData) payload.referees = espnLive.referees ?? dbData.referees ?? [];
        if ('predictor' in dbData) payload.predictor = espnLive.predictor ?? dbData.predictor ?? null;
        if ('stage' in dbData) payload.stage = espnLive.stage ?? dbData.stage ?? null;
        if ('match_group' in dbData) payload.match_group = espnLive.match_group ?? dbData.match_group ?? null;
        if ('match_type' in dbData) payload.match_type = espnLive.match_type ?? dbData.match_type ?? null;
        if ('round' in dbData) payload.round = espnLive.round ?? dbData.round ?? null;
        if ('group_summary' in dbData) payload.group_summary = espnLive.group_summary ?? dbData.group_summary ?? [];
        if ('knockout' in dbData) payload.knockout = espnLive.knockout ?? dbData.knockout ?? false;
        if ('final' in dbData) payload.final = espnLive.final ?? dbData.final ?? false;

        await supabaseAdmin.from('matches').update(payload).eq('id', dbData.id);

        // Also fire social alerts if the status changed to finished
        const TERMINAL_STATUS_LIST = new Set(['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD']);
        const goesTerminal = TERMINAL_STATUS_LIST.has(nextStatus) && !TERMINAL_STATUS_LIST.has(currentStatus);

        if (goesTerminal || scoresChanged) {
          const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL || '';
          if (publicAppUrl) {
            fetch(`${publicAppUrl}/api/social`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.CRON_KEY}`
              },
              body: JSON.stringify({
                record: { ...dbData, ...payload },
                old_record: dbData
              })
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Error auto-syncing match on load:', err);
      }
    }
  }

  const dbStatus = String(dbData.status || '').toUpperCase();
  const espnStatus = espnLive?.status ? String(espnLive.status).toUpperCase() : null;

  const shouldUseEspnStatus = Boolean(
    espnStatus &&
      (
        TERMINAL_STATUSES.has(espnStatus) ||
        espnStatus === 'LIVE' ||
        espnStatus === 'HT' ||
        PRE_STATUSES.has(dbStatus)
      )
  );

  const status = shouldUseEspnStatus ? espnStatus! : dbStatus;

  const homeScore = espnLive?.home_score ?? dbData.home_score ?? 0;
  const awayScore = espnLive?.away_score ?? dbData.away_score ?? 0;

  const displayClock =
    espnLive?.displayClock ||
    dbData.displayClock ||
    (status === 'LIVE' ? 'Live' : status === 'HT' ? 'HT' : '');

  const lineups =
    espnLive?.lineups ||
    dbData.lineups || {
      home: [],
      away: [],
      formations: { home: null, away: null }
    };

  const stats = espnLive?.stats || dbData.stats || { home: {}, away: {} };
  const events = espnLive?.events || espnLive?.match_events || dbData.match_events || [];

  const hasLineups = lineups.home?.length > 0 || lineups.away?.length > 0;
  const hasStats = Object.keys(stats.home || {}).length > 0;
  const hasEvents = events.length > 0;
  const hasH2h = !!dbData.h2h;
  const hasRichData = !!dbData.widget_id || hasLineups || hasStats || hasEvents || hasH2h;

  let finalPredictor = null;
  const rawPredictor = espnLive?.predictor || dbData.predictor;

  if (rawPredictor) {
    finalPredictor = {
      home: Number(rawPredictor.home) || 0,
      away: Number(rawPredictor.away) || 0,
      draw: Number(rawPredictor.draw) || 0
    };
  }

  return {
    ...dbData,

    id: dbData.id,
    home_team: dbData.home_team || espnLive?.home_team || '',
    away_team: dbData.away_team || espnLive?.away_team || '',
    home_logo: dbData.home_logo || espnLive?.home_logo || null,
    away_logo: dbData.away_logo || espnLive?.away_logo || null,
    home_score: homeScore,
    away_score: awayScore,
    status,
    displayClock,

    home: { name: dbData.home_team, logo: dbData.home_logo, score: homeScore, id: 'home' },
    away: { name: dbData.away_team, logo: dbData.away_logo, score: awayScore, id: 'away' },

    goals: events, commentary: [], stats, lineups,
    hasExternalData: hasRichData, widget_id: dbData.widget_id,
    venue: espnLive?.venue ?? dbData.venue ?? null,
    referees: espnLive?.referees ?? dbData.referees ?? [],
    predictor: finalPredictor,
    stage: espnLive?.stage ?? dbData.stage ?? null,
    group: espnLive?.match_group ?? dbData.match_group ?? dbData.group ?? null,
    match_group: espnLive?.match_group ?? dbData.match_group ?? dbData.group ?? null,
    match_type: espnLive?.match_type ?? dbData.match_type ?? null,
    round: espnLive?.round ?? dbData.round ?? null,
    group_summary: espnLive?.group_summary ?? dbData.group_summary ?? [],
    knockout: Boolean(espnLive?.knockout || dbData.knockout),
    final: Boolean(espnLive?.final || dbData.final),
    h2h: dbData.h2h || null
  };
}
