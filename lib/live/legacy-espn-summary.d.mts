/** Types for the D1-free ESPN mapping extracted from the original fast Worker. */
export type FastEspnSummary = {
  status: string;
  home_score: number | null;
  away_score: number | null;
  displayClock: string;
  match_events: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  stats: Record<string, unknown>;
  lineups: Record<string, unknown>;
  venue: string | null;
  referees: string[];
  predictor?: Record<string, unknown>;
};
export function normalizeLegacyEspnSummary(data: unknown, espnId: string): FastEspnSummary;
