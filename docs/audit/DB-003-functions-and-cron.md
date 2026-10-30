# DB-003 — Database function and scheduler inventory
Date: 2026-10-30
Status: DB VERIFIED function names/signatures, scheduler table existence; definitions mostly NOT VERIFIED; no production writes.

## User-supplied SQL 12
11 public functions:
- `audit_monthly_winners()` -> table(rank,user_name,total_points,exact_scores,passed_floor,leagues_hit,has_home_away_draw,zero_zero_count,passed_audit); SECURITY INVOKER; volatile.
- `delete_old_matches(months_to_keep integer)` -> void; SECURITY DEFINER; volatile.
- `handle_new_user()` -> trigger; SECURITY DEFINER; volatile.
- `handle_verification_update()` -> trigger; SECURITY DEFINER; volatile.
- `is_admin()` -> boolean SQL; SECURITY DEFINER; volatile.
- `protect_profile_stats()` -> trigger; SECURITY INVOKER; volatile. Full definition previously reviewed.
- `refresh_group_standings_from_matches(p_league_name text, p_season text)` -> table(league_name,group_name,rows_affected); SECURITY INVOKER; volatile.
- `reset_monthly_leaderboard()` -> void; SECURITY DEFINER; volatile.
- `secure_prediction_insert()` -> trigger; SECURITY DEFINER; volatile.
- `secure_predictions()` -> trigger; SECURITY INVOKER; volatile. Full definition previously reviewed.
- `settle_match_points(target_match_id text)` -> void; SECURITY INVOKER; volatile. Full definition previously reviewed.

SECURITY DEFINER means caller may execute with function owner privileges, subject to ownership, grants, definitions and search_path. Audit `EXECUTE` grants, explicit schema qualification, search_path, caller authorization, security context, row/column changes, and trigger wiring before copying anything.

## User-supplied SQL 13
- `to_regclass('cron.job') IS NOT NULL`: true
- `to_regclass('cron.job_run_details') IS NOT NULL`: true
This confirms pg_cron relations exist, NOT that any active jobs exist or what they do.
- Extension version listing from SQL 13 was not included in supplied output. Treat as pending.

## Source-code cross-check
- `app/api/settle/route.ts`: invokes `settle_match_points` RPC then separately marks `matches.points_distributed=true`. Partial transaction/idempotency risk remains.
- `app/admin/actions.ts`: winner audit/manipulation implemented in TypeScript, including `monthly_winners` write; compare to `audit_monthly_winners` database function to avoid double or inconsistent paths.
- `app/api/sync-fd/route.ts`: standings updates via fetch and delete/insert, independently of `refresh_group_standings_from_matches`; inspect when database function is used and whether it would overwrite provider standings.
- Expected monthly reset routes under `app/api/cron/monthly-reset`, `app/api/cron/reset-monthly`, and cleanup were NOT found at those guessed paths; do not treat as proof there are no schedulers.
- New clean-data reset rule still requires keeping all these SQL capabilities or deliberate documented equivalents, even if old match/leaderboard rows aren't imported.

## Priority uninspected definitions
P0 `is_admin`, `secure_prediction_insert`, `handle_new_user`, `handle_verification_update`, `reset_monthly_leaderboard`, `delete_old_matches`.
P1 `audit_monthly_winners`, `refresh_group_standings_from_matches`.
Review actual pg_trigger and pg_proc dependencies, RLS, GRANT EXECUTE, current configuration/contract assumptions.
No execute/RPC of business functions during audit.

## Next safe read-only SQL 14 — Cron metadata, no command bodies
```sql
SELECT jobid, jobname, schedule, active, database, username
FROM cron.job
ORDER BY jobid;
```
If `jobname` is not present in this pg_cron version, omit it. Never SELECT `command` into chat; cron commands can embed keys and webhook URLs.
Depending on SQL Editor grants, this query may be restricted; use only authorized access.

## Next safe read-only SQL 15 — Privileged function properties/grants
```sql
SELECT p.proname,
 pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef AS security_definer,
 p.proconfig AS function_configuration,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
ORDER BY p.proname;
```
Function configuration values can theoretically include secrets; review before sharing. If unsure, omit `function_configuration`.

## Next safe function source retrieval
Fetch individual `pg_get_functiondef` for P0 functions and redact passwords, webhook tokens, email addresses, secrets or other sensitive constants before sharing. Do not commit raw definitions to public repository.
