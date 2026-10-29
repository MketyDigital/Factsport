# DB-001 — Supabase schema inventory and settlement audit
Date: 2026-10-30
Branch: refactor/factsport-v2
Status: DB metadata reviewed; schema/function coverage partial; NO database mutations performed.

## Source evidence
User-supplied Supabase SQL results: public relation summary, trigger inventory, full public index inventory, and `public.settle_match_points(target_match_id text)` definition. These results are **not** committed because they may contain secrets/private operational data. Findings below are deliberately sanitized.

## Schema inventory
18 public tables: automation_logs, campaign_leaderboards, campaigns, cron_logs, global_studio, matches, monthly_winners, news, predictions, profiles, site_settings, standings, subscriptions, team_logos, teams, top_players, tournament_scorers, user_predictions.
All 18 reported RLS enabled (not forced). RLS policy definitions are NOT yet reviewed.
Estimated rows: matches ~2506, news ~366, standings ~292, team_logos ~182, cron_logs ~411, tournament_scorers ~20, monthly_winners ~17, profiles ~3, user_predictions ~3. Estimates are not proof of exact totals.

## Important function-backed behavior
`settle_match_points`: monthly track awards 3 for correct outcome AND 10 for correct exact score (so exact score yields 13 in ordinary case). Campaign track configures outcome, score, first-scorer, red-card, penalty awards. Exact-score awards from matching home/away FT values. Uses `user_predictions.is_eligible_for_prize` for separate eligible points and score tallies; does not itself determine the first five predictions per day.
Campaign auto-detection uses match campaign_id when present, otherwise first active campaign matching target_leagues. Winner-eligibility and minimum points validation are NOT within this function.
Uses accumulated increments on campaign_leaderboards and profiles, with no in-function check for already settled predictions. API route checks points_distributed false before RPC, but this does not eliminate repeated/concurrent execution risk. **HIGH: need transactional idempotency and match locking, correction/reversal plan.**
Function picks first `goal` in JSONB match_events iteration. Must verify events are ordered and identify own goals/penalty/VAR semantics.
Red-card and penalty events are evaluated as booleans from event types; first scorer uses direct string equality. Need event-type corpus and normalization.
Monthly bonus flag and rules agreement must be tested against documented How to Play.

## Triggers
- matches INSERT and score/status/event/lineup UPDATE call social endpoint via Supabase HTTP webhook.
- profiles BEFORE UPDATE -> protect_profile_stats()
- user_predictions BEFORE INSERT/UPDATE -> secure_predictions()
**HIGH SECURITY: trigger SQL text supplied in conversation contained a potential reusable Authorization bearer value. Treat as compromised and rotate endpoint authorization credentials promptly. This value is intentionally NOT recorded here.** Inspect all webhook registrations for stale tokens and update them.
**MEDIUM/HIGH potential duplicate social events:** live route also posts to /api/social. Inspect its internal deduplication before concluding behavior.

## Index considerations
Matches has overlapping API ID and ESPN ID indexes, including multiple unique API ID indexes. Do not drop before `pg_stat_user_indexes`/query plans and full uniqueness review. User prediction uniqueness on (user_id,match_id) is a preservation requirement. Campaign leaderboard unique (campaign_id,user_id).

## Next required non-sensitive evidence
1. Public column definitions and constraints (SQL 02A/02B).
2. public RLS policies and function signatures (SQL 03A/03B), including any SECURITY DEFINER issues.
3. Function definitions: `secure_predictions`, `protect_profile_stats`, eligibility/reset logic (redact secrets).
4. Exact counts and data size only when needed; no private user rows.
5. Database scheduled jobs: names, schedules and commands with credentials redacted.
6. Check for app-auth and storage object metadata separately; don't expose auth.users data.

## Migration gates
- No migration to Mkety Core PostgreSQL until schema, triggers, RLS, auth identity linkages, functions, cron and storage inventoried.
- Settlement must be tested for exactly-once effect, race safety, correction handling and monthly reset preservation.
- Production remains paused; do not invoke settlement RPC during audit.
