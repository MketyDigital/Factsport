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
