# SPORTS-001 — Fixture, standings and scheduled-workflow source audit
Date: 2026-10-30
Status: SOURCE VERIFIED for listed files; NOT RUNTIME VERIFIED; no application/production writes.

## Scope / source evidence
Directly reviewed:
- `.github/workflows/schedule.yml`, `.github/workflows/matchmaker.yml`, `.github/workflows/monthly-audit.yml`, `.github/workflows/allInOne.yml`
- `scripts/sync-gh.js`, `scripts/fetch-espn-cups.js`
- `app/api/matches/route.ts`, `app/api/match/[id]/route.ts`, `app/api/match-data/route.ts`, `app/api/cache/standings/route.ts`, `app/standings/page.tsx`
- Previously reviewed `app/api/sync-fd/route.ts`, `app/api/matchmaker/route.ts`, `app/api/live/route.ts`, `app/lib/matchService.ts`, `app/lib/espn.ts`, `app/api/settle/route.ts`, and `app/api/admin/run-audit/route.ts`.

## Confirmed multi-engine ingestion
1. `.github/workflows/schedule.yml`: every 12 hours, runs `scripts/sync-gh.js` then `scripts/fetch-espn-cups.js`. `sync-gh.js` reads football-data.org competition matches from around 3 days in past to 35 days ahead, preserves some stored detailed fields, downloads logos, stores them in Supabase `team-logos`, and builds fixtures. It has explicit 429 backoff. `fetch-espn-cups.js` fetches ESPN cup fixtures over a similar window and upserts `matches` on `api_id`; maps ESPN ID to both `api_id` and `espn_id`.
2. `.github/workflows/matchmaker.yml`: at 06:00 and 12:00 UTC, invokes `/api/matchmaker` for ESPN ID reconciliation.
3. `app/api/sync-fd/route.ts`: separate match/standings update route from football-data.org, with ESPN standings fallback; deletes and inserts league standings rows when refreshing. Whether and how often route runs is not established from these particular workflow files; search all schedulers/external cron.
4. `app/api/live/route.ts`: live ESPN augmentation/social handling, uses isolate-local Map for some deduplication. Production isolation and durable dedupe require redesign.
5. `app/standings/page.tsx`: public standings page reads `standings` and `matches`, groups cup results using the existing standings records. It does **not** require absent `group_standings` table in the inspected page. `app/api/cache/standings/route.ts` reads `standings` by league_code and caches for 60s.
6. `app/api/matches/route.ts`: paginated fixtures/results reading `matches`; 15 at a time, cursor by match_date. `app/api/match/[id]/route.ts`: match detail from DB plus `getExternalData` from matchService. `app/api/match-data/route.ts`: narrow live polling fields with different caching by status (5s live, 60s scheduled, 3600s completed).

## Scheduler inventory (GitHub + Supabase)
- GitHub `schedule.yml`: 00:00 and 12:00 UTC fixture sync.
- GitHub `matchmaker.yml`: 06:00 and 12:00 UTC ESPN reconciliation.
- GitHub `allInOne.yml`: hourly 02:00–12:00 UTC AI pro analysis, 08:00 UTC article preview, 22:40 UTC summary. 08:00 overlaps hourly window; workflow trigger matrix must be checked for unwanted duplicate job invocations (job-level conditional logic).
- GitHub `monthly-audit.yml`: 00:00 UTC on first of month invokes `/api/admin/run-audit`; application route was previously shown to have incompatible exact-score comparison and eligibility issues.
- Supabase pg_cron, 3 active jobs: delete-unconfirmed-users 03:00; cleanup-old-cron-logs 03:00; daily-socials-cleanup 23:59 (scheduler timezone unverified). Actual SQL commands not supplied.
- Deployment migration preference: GitHub runners dev-only, Cloudflare production scheduled triggers; preserve all functional jobs but eliminate unintended overlap, disable job-by-job until approved, durable locks/idempotency.

## High risks / modernization requirements
- **Two identifiers**: football-data.org fixtures use provider IDs, while ESPN cups directly assign `api_id=espn_id`; matchmaker reconciles ESPN counterparts. Combined uniqueness indexes on `api_id` and `espn_id` mean race, overlap, duplicates and cross-provider identity mismatches must be tested. Design canonical match identity plus provider ID mapping table, league/season/date/team matching, provenance and conflict audit.
- **Match list retrieval**: pagination uses `match_date` as sole cursor. Identical kickoff times can cause skipped/duplicate records across pages. Prefer deterministic compound cursor (match_date, id).
- **Classification**: various consumers use different sets of finished/live status labels including `ABD` as finished in some paths. Define one normalized status contract; abandoned/cancelled outcomes should not automatically settle scores, standings or predictions.
- **Source priorities**: standings refresh may delete/replace rows; ensure atomic swap/upsert with season and league isolation, validation, last-successful cache and provider fallback. A bad temporary upstream response must not destroy the last reliable table.
- **External-data route auth**: `app/api/match/[id]/route.ts` and `app/api/match-data/route.ts` rely on Referer or Sec-Fetch-Site headers to infer same-origin access, plus a CRON_KEY override. These headers are not reliable authentication; use public rate-limited reader routes or real server-to-server auth. Never place cron credentials in URL query params.
- **External endpoint**: `.github/workflows/matchmaker.yml` puts cron key in query string; avoid credentials in logs/URLs after modernization.
- **Storage**: logo script writes to Supabase Storage `team-logos` bucket; social handler uses `socials` bucket. Preserve through reviewed R2-equivalent and asset rights checks.
- **Clean restart**: do not import old match/standings/stats/predictions. Fixture bootstrap after deployment must repopulate expected leagues, standings, logos and match IDs with social notification backfill disabled.
- **Broken group standings SQL**: `refresh_group_standings_from_matches()` refers to `public.group_standings`, confirmed nonexistent in current DB. Public standings page uses `standings` instead; preserve functioning cup display and decide how to rebuild any group standings calculations.
- **No build/test assertions**: this is source-based review only; no runtime testing or vinext compatibility validation yet.

## Schema dependencies still to confirm via read-only SQL
1. Table column definitions and PK/FK/unique/check constraints for matches, standings, teams, team_logos, tournament_scorers, campaigns, campaign_leaderboards and news.
2. Critical defaults: matches ID/provider IDs/points_distributed/status/season/match_group, predictions eligibility/settlement, published editorial metadata.
3. Provider sync source-of-truth flags and schema constraints; presence and ownership of storage buckets. No object contents or private paths needed.
4. Application-level status normalization regression fixtures, league naming collisions, venue/timezone and stale feed fallbacks.

### SQL 21 (READ ONLY) — Football data columns
```sql
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('matches','standings','teams','team_logos','tournament_scorers','campaigns','campaign_leaderboards')
ORDER BY table_name, ordinal_position;
```

### SQL 22 (READ ONLY) — Constraints and relationships
```sql
SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name,
       CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUDE'
            ELSE c.contype::text END AS constraint_type,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid=c.connamespace
WHERE n.nspname='public'
ORDER BY table_name, constraint_type, constraint_name;
```
Inspect results for any unexpected private names before sharing; returns definitions, not row data.

## Acceptance gates
- All known scheduler triggers and data writes documented, owner-selected production schedules with non-overlapping idempotent behavior.
- Dual feed and standings parity tests against sanitized fixtures.
- Live status, postponed/abandoned/no-score semantics documented.
- Safe fresh bootstrap and zero-history verification on staging.
- No work on main or old production schema.

## Authoritative user correction — ESPN LIVE FIRST (2026-10-30)
User explicitly corrected audit emphasis: **ESPN powers live updates; football-data.org supports matches that could not be matched/synced via ESPN and final-time score checking.** Provider ID overlap is a *possible migration risk*, not verified current collision. Preserve existing priority and fallback behavior above all generic dual-provider arbitration suggestions.

Source corroboration:
- `app/api/live/route.ts`: selects DB matches with `espn_id`, fetches ESPN scoreboard/details, derives LIVE/HT/FT status, scores, clock and match events. The `isTrackedByFD=!!dbMatch.api_id` name is misleading because ESPN cup script also assigns api_id; don't derive source identity from mere api_id presence.
- `app/api/sync-fd/route.ts` lines ~125-158: when espn_id present, skips football-data.org LIVE/SCHEDULED updates and only uses FD FT to reconcile final status/scores; when no ESPN ID, can update missing LIVE/HT/FT status. This is direct source confirmation of user intent.
- `app/api/matchmaker/route.ts`: ESPN fuzzy name/time matching assigns `espn_id` to existing matches; preserves primary `id`. ESPN cup script may create direct ESPN ID fixtures.
- `app/lib/matchService.ts`: match detail favors ESPN rich match data when `espn_id` exists; DB fallback.
- `scripts/sync-gh.js`: football-data.org scheduled fixture bootstrap/refresh; status safeguards skip some near-live windows, and separate cup ESPN bootstrap script. These are secondary fixture ingestion paths and **must not displace ESPN live authority**.
Target provider policy: (1) ESPN for live score, status, clock, events, lineups, stats whenever matched; (2) FD for unable-to-match/unsynced fixture updates or missing live linkage; (3) FD FT result verification/reconciliation, recording discrepancy and finalization state; (4) never let an inferior/stale update regress a verified match. The exact FT disagreement resolution requires tests/published policy and cannot be inferred beyond current code.
Target identity: preserve `matches.id` stable as canonical public/prediction FK; add provider mapping `provider, external_id, match_id, mapping_confidence, mapped_at` with unique(provider,external_id). Do NOT assert collisions have occurred. Matchmaker needs collision tests, aliases, kickoff changes, ESPN cup direct imports and linked game predictions.

### SQL 21 uploaded column metadata, SQL 22 constraints pasted by user
- `matches.id` is TEXT primary key with `gen_random_uuid()` default coercion; provider fields `api_id text` (unique twice) and `espn_id text` (no unique constraint in supplied SQL 22), `points_distributed boolean DEFAULT false`, `status`, `match_date timestamptz`, rich ESPN events/lineups/stats fields, group_summary, stage, match_group, knockout/final, campaign FK. Source SQL21 ordinal positions have gaps (19, 23-31, 37-40); don't assume those columns are absent or known.
- `standings`: PK id uuid, UNIQUE(league_code,team_id), fields position, team_id integer, points, game stats, match_group, but no season in supplied column list. Migration requires season and group isolation for multiple editions.
- `teams`: uuid PK, unique name, logo/stadium/fanart/jersey. `team_logos`: bigint PK, unique team_name; legacy logo assets require source/rights decisions.
- `tournament_scorers`: uuid PK, unique (league_code, player_id); no season uniqueness, player_id nullable. Preserve derived stats while avoiding duplicate/nullable ID collisions.
- `campaigns`: uuid PK, title,type,start/end,active, target_leagues jsonb, rules jsonb, VIP flag. `campaign_leaderboards`: composite PK (campaign_id,user_id), FKs to campaigns/profiles ON DELETE CASCADE.
- `matches.campaign_id` FK to campaigns ON DELETE SET NULL.
- `user_predictions`: FK to matches ON DELETE CASCADE, auth.users ON DELETE CASCADE, campaigns ON DELETE SET NULL; CHECK no_negative_scores; duplicate-equivalent UNIQUE(user_id,match_id) and UNIQUE(match_id,user_id). These must be reviewed before simplifying.
- `predictions` legacy references profiles and matches without cascade; separate from user_predictions.
- `profiles.id` FK auth.users ON DELETE CASCADE; `subscriptions.user_id` FK to profiles with no cascade.
- `news.slug` UNIQUE, essential to preserve authored article URLs.
- `cron_logs.run_date` UNIQUE; other tables have PKs. No CHECK constraints for status/score beyond user_predictions nonnegative score in supplied export. The complete default/index inventory remains distinct.
- Correct index/unique inference: two duplicate `matches.api_id` unique constraints and two redundant `user_predictions` pair-order unique constraints. Do not drop in current DB.
- User supplied SQL21 file had 95 data rows with details; document only schema, no rows or private values.
- **Versioned design**, not immediate write: stable ID, explicit source provenance and final result checks, schema with season, index/unique constraints, cleanup of duplicate constraints after tests. No Supabase mutations.

### Documentation availability
The repository recursive tree (refactor/factsport-v2) contains no original README or other notes/info markdown beyond newly created docs/audit; source comments, workflows and scripts are reviewed. If other documentation is stored outside tracked repository or in another branch/connected Drive, it has not been inspected and must not be claimed reviewed.

## M4 isolated ESPN-first decision contract — committed 2026-10-30
- `lib/match-source-policy.cjs` added: pure `decideScoreUpdate(match, update, provider)`, `canonicalStatus`, `hasFinalScore`; does not fetch, mutate DB, schedule, or send social posts. Explicit actions: `apply`, `ignore`, `review`.
- `tests/match-source-policy.test.cjs` added 11 node:test cases covering ESPN live priority, unmatched football-data fallback, ESPN-linked FT verification, repeated FT avoidance, missing FT scores, terminal status regression, abandoned match manual review, provider normalization.
- `package.json` now exposes `npm run test:engine` with `node --test tests/*.test.cjs`. No new dependencies, no framework upgrades or production route changes.
- **RUNTIME STATUS: NOT VERIFIED**. Attempt to fetch branch files into isolated local runtime for Node execution failed due environment DNS/network restriction. Tests are committed but not claimed passing; CI/runner or local checkout must execute them.
- This test-oriented policy is a *proposed* stricter decision boundary, not a statement that the current live route enforces all cases. Current live route can update terminal statuses based on ESPN state, uses `!!api_id` as inaccurate FD-tracking proxy, module-local Map for social dedupe, and sends unawaited asynchronous social fetch. FD `sync-fd` updates ESPN-linked FT scores immediately (proposed policy holds discrepancies for review); **must validate product-approved correction behavior before connecting the module**.
- Next implementation gate: run isolated tests; add contract tests driven by snapshot/sanitized feed fixtures; decide if FD FT disagreements auto-correct or require review; wire policy behind flag only after functional and staging parity.

## Provider architecture clarification — UPDATED 2026-10-30 (overrides earlier shorthand)
User's authoritative explanation:
1. **football-data.org is the main fixture/schedule/competition ingestion engine** for **all leagues and fixtures available within its free tier**, including its existing score/status feed. Its live scores can lag approximately **5–15 minutes** (user-reported operational expectation, not externally measured here).
2. **ESPN fills competition/fixture coverage gaps** for supported leagues/tournaments not furnished by football-data.org's free tier.
3. **ESPN is the preferred faster LIVE score/status/clock/events engine** for *both* (a) ESPN-originated coverage and (b) football-data.org-originated fixtures matched to ESPN by the matchmaker. A match's fixture origin does not determine its live-source authority.
4. **football-data.org remains an actual live fallback** for fixtures that ESPN matchmaker cannot link or whose ESPN live feed cannot synchronize under the approved fallback policy; its slower live scores still have user value. It also verifies/reconciles **FT final scores**. Never discard FD live updates across unmatched matches.
5. Preserve internal `matches.id`, fixture provenance, separate `api_id` and `espn_id` roles, standings, campaigns and prediction FKs. Confirm competition coverage and data provenance before deduping.
6. **Outstanding product decision:** If a formerly ESPN-matched fixture temporarily loses its ESPN feed during play, should the FD delayed live feed temporarily take over (with freshness indicators), or should the last ESPN values remain until ESPN recovers? Current `sync-fd` implementation blocks FD live updates whenever `espn_id` exists; this is separate from truly unmatched matches. Ask owner before changing.
7. Note: the initial phrase "football-data.org secondary fixture ingestion" in the previous section is superseded; it is **the primary free-tier fixture feed**, *not* a secondary ingestion system. The earlier "ESPN live first" section remains accurate *only for live-update selection once ESPN is linked*.
8. **Current code verification**: `scripts/sync-gh.js` fetches football-data.org scheduled competition fixtures; `scripts/fetch-espn-cups.js` inserts ESPN-supported cup fixtures; `app/api/matchmaker/route.ts` links ESPN IDs to existing `matches.id`; `app/api/live/route.ts` fetches ESPN for matched games; `app/api/sync-fd/route.ts` updates live/FT for unlinked FD matches and FT checks for ESPN-linked FD-origin matches. The optional source decision helper does not replace these ingestion processes.
9. The standalone `lib/match-source-policy.cjs` concerns update arbitration **after fixture bootstrap and ESPN matching**. It is not an ingestion orchestrator. It cannot be used to eliminate the football-data.org primary fixture-fetch phase.
