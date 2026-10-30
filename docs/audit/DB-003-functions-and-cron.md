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

## SQL 14 / SQL 15 verified user output — 2026-10-30
**Cron:** 3 active `cron.job` entries, database `postgres`, role `postgres`:
- job 1 `delete-unconfirmed-users` at `0 3 * * *`
- job 2 `cleanup-old-cron-logs` at `0 3 * * *`
- job 3 `daily-socials-cleanup` at `59 23 * * *`.
These are scheduling metadata, NOT inspected command bodies. Their names imply intent only. Do not assume UTC or actual retention logic without inspecting scheduler settings/commands. Treat account cleanup and social asset removal as potentially destructive. For migration, implement/retire each deliberately after confirming behavior, data retention and Cloudflare scheduled event integration.

**Function EXECUTE:** All 11 `public` functions report `has_function_privilege('anon',oid,'EXECUTE')=true` and the same for `authenticated`. This is a confirmed dangerous grant posture, but not blanket proof of API reachability/exploitation: trigger functions typically cannot be invoked as ordinary RPC; schema exposure, function checks and effective identities matter. In particular:
- `reset_monthly_leaderboard()` SECURITY DEFINER + publicly granted EXECUTE: P0 body/authorization inspection; possible destructive reset if exposed.
- `delete_old_matches(months_to_keep integer)` SECURITY DEFINER + publicly granted EXECUTE: P0 body/authorization inspection; parameter bounds, caller checks and search_path needed.
- `is_admin()` SECURITY DEFINER + publicly granted EXECUTE: ensure secure identity derivation and search_path.
- `settle_match_points(target_match_id text)` invoker (not definer) + publicly granted EXECUTE: test privileges and safeguards; separately documented non-idempotent point increments.
- `refresh_group_standings_from_matches` invoker + publicly granted EXECUTE: determine SQL writes/impact and callers.
- `handle_new_user`, `handle_verification_update`, `secure_prediction_insert`, `secure_predictions`, `protect_profile_stats` return trigger and cannot normally execute as standalone database RPC; still inspect trigger attachments and security contexts.

**Plan:** target PostgreSQL default REVOKE EXECUTE from PUBLIC on privileged functions, grant to explicit narrowly scoped roles, require server-side identity and idempotency, test with separate credentials. Do not deploy SQL grants without owner-approved plan and rollback.

### Next safe query — Extract privileged function bodies locally for human review
```sql
SELECT p.proname AS function_name,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND p.proname IN ('reset_monthly_leaderboard','delete_old_matches','is_admin','secure_prediction_insert')
ORDER BY p.proname;
```
**Redact** tokens, hardcoded passwords, personally identifying data, direct credentials and privileged endpoints before sharing results. No functions are executed by this read-only query.

### Next safe query — cron command safety characteristics without returning commands
```sql
SELECT jobid, jobname, schedule, active,
       length(command) AS command_length,
       command ~* '(delete|truncate|drop)' AS contains_delete_keyword,
       command ~* '(http|net\\.|fetch|webhook)' AS contains_network_keyword
FROM cron.job
ORDER BY jobid;
```
This is a heuristic only; cannot prove actual job behavior. To understand semantics fully, human owner should review command locally and share redacted command text, with secrets removed.

## SQL 16 / 17 verified (2026-10-30)
User provided actual function definitions for four functions and cron command characteristics. No database modification performed.

### CRITICAL: `reset_monthly_leaderboard()`
- SECURITY DEFINER; body consists solely of `UPDATE public.profiles SET monthly_points=0, monthly_correct_scores=0`, with no authorization, period boundary, audit or transactional snapshot logic.
- SQL 15 confirms both anon and authenticated EXECUTE granted. If callable via exposed API/RPC, untrusted callers could potentially reset all monthly scores. Do NOT claim direct internet exploit tested.
- Does not clear eligible_monthly_points or eligible_monthly_correct_scores; inconsistent state possible, depending on other reset pathways.
- Target: least-privilege scheduled server task, period-keyed idempotent rollover, finalization of winners, archive/audit, and atomic counter transition. Preserve historical winner obligations by separate owner-approved retention policy.

### HIGH: `secure_prediction_insert()`
- SECURITY DEFINER trigger function: NEW.status='PENDING', blocks matches whose kickoff is <=now; fetches `site_settings.daily_limit` (defaults 5); counts user_predictions created on CURRENT_DATE; sets is_eligible_for_prize true when count below d_limit, false otherwise.
- Crucial **wiring unverified**: earlier user-supplied non-internal public trigger list showed `user_predictions` enforcement trigger calling `secure_predictions()`, NOT `secure_prediction_insert()`. If no trigger attaches this function, it will not run during writes. Check pg_trigger for all trigger schemas/disabled states and trigger names.
- Function's kickoff guard checks `IF EXISTS` for match kickoff<=now but does not reject a missing referenced match by itself. Need FK verification.
- COUNT + insert not concurrency serialized, so simultaneous submissions may both be marked eligible; daily boundaries use database `CURRENT_DATE` and `DATE(created_at)`, potentially diverging from user-facing timezone; need explicit published competition timezone and atomic allocation.
- d_limit <= 0, NULL settings, multiple settings rows, identity spoofing and manual eligibility flags require validated schema, grants, trigger behavior and server checks.
- It marks beyond-limit entries ineligible for prizes; doesn't inherently block submission. Preserve confirmed intended rule and compare UI and code.

### HIGH: `delete_old_matches(months_to_keep integer DEFAULT 12)`
- SECURITY DEFINER and granted EXECUTE anon/auth, but body queries `auth.users` for current `auth.uid()` email and rejects callers outside a hardcoded two-email allowlist. This materially reduces direct risk vs reset_monthly_leaderboard; no conclusion of unauthorized deletion without testing auth context.
- No bounds check on months_to_keep. A negative value can produce future cutoff, expanding deletion scope. Deletes `user_predictions` for old matches, then `matches`. Cleanup must be privileged, range-validated, dry-run preview, idempotent and explicitly audited.
- Uses unqualified table names in SECURITY DEFINER function, with no visible SET search_path; review safe search_path/schema qualification.

### `is_admin()`
- SECURITY DEFINER SQL function returns existence of `public.profiles` row where `id=auth.uid()` and `role='admin'`. It is not directly a write operation; trust depends on whether role can be controlled through other paths. Unlike global_studio's user_metadata claim, this function reads server profile role.
- No declared search_path; establish safe configuration, caller authorization, and role-write protections. Public EXECUTE on role-check function is not independently proof of privilege escalation.

### SQL 17 cron characteristics
- Job 1 delete-unconfirmed-users: command length 124, delete keyword true, network false.
- Job 2 cleanup-old-cron-logs: command length 70, delete keyword true, network false.
- Job 3 daily-socials-cleanup: command length 554, delete keyword false, network true.
- No command bodies shared; actual retention, network targets, credential usage and side effects NOT verified. No assumption of benign delete-free behavior just because regex false.

### Highest priority next step
1. Check **effective trigger attachments** to determine whether `secure_prediction_insert` ever runs. A function existing in public schema is not enough.
2. Check controlled function RPC exposure and restrict monthly reset execution urgently with authorized production change process (do not provide blind modifications to live production).
3. Request remaining definitions for monthly winner audit, account signup/verification, standings refresh, and monthly reset interactions.
4. Inspect pg_cron commands locally with secrets redacted before sharing. Do not paste raw commands containing service keys.

## SQL 18/19 — Trigger wiring and remaining function bodies (2026-10-30)
Evidence: user-supplied trigger result and full function definitions; no function executed or DB writes performed.

### P0 CONFIRMED — missing eligibility trigger
SQL 18 lists one non-internal trigger invoking either prediction function: `public.user_predictions.enforce_prediction_security` (enabled O), calling `secure_predictions()` BEFORE INSERT OR UPDATE. There is **no trigger attachment for `secure_prediction_insert()`** in the supplied result. Thus the function that sets status PENDING and computes `is_eligible_for_prize` using `site_settings.daily_limit` (default 5) **does not execute through a currently attached trigger**. Verify whether application insert path sets eligibility itself; if not, daily prize eligibility is not assigned reliably. Do not attach it blindly; design one atomic authoritative insert path with matching identity/clock/start-time checks.

### P0 / HIGH — monthly audit inconsistent with settlement
`audit_monthly_winners()` uses `p.points_awarded = 10` to select 'exact scores'. But `settle_match_points()` awards 3 points for correct outcome PLUS 10 for exact score. Under consistent outcome/score predictions, exact scores yield **13**, so `=10` excludes them. Function selects top 3 VIP accounts by `monthly_points` and `monthly_correct_scores`, while app-level `app/admin/actions.ts` winner audit selects top 5 ordered by `eligible_monthly_points`. DB audit also uses `EXTRACT(MONTH FROM created_at)` without year and takes active weeks from prediction creation dates rather than match settlement dates. It uses total monthly counters, not prize-eligible counters, for floor/exact score checks. DB SQL may return NULL audits if LEFT JOIN data absent. These are significant divergence and correctness risks.
`app/admin/actions.ts` uses `.gte('points_awarded',10)` for presumed exact score, which includes 13 but depends on rules; needs explicit exact_score boolean or actual result check and current-month / is_eligible_for_prize constraints. App action ranks up to five and writes `monthly_winners` with hard-coded prizes, requires server-side authorization review. SQL audit and app action must be reconciled to one published, testable ruleset.

### Account lifecycle
`handle_new_user()` SECURITY DEFINER initializes profile on auth user creation (email, full_name, phone, points/monthly_points/eligible_monthly_points=0, is_vip=false, role=user). Does not explicitly initialize every counter/flag: rely on defaults only after schema confirmed.
`handle_verification_update()` SECURITY DEFINER sets `profiles.is_verified=true` upon `auth.users.email_confirmed_at` transition NULL -> non-NULL. Need verify triggers on auth.users (not listed in public-only trigger audit) and new authentication provider event equivalents.

### Group standings function — unresolved broken dependency
`refresh_group_standings_from_matches(p_league_name,p_season)` deletes/rebuilds `public.group_standings` from `matches`. However initial user-supplied public relations inventory listed no `group_standings` table/view. This is a strong **schema drift / missing relation** concern; verify `to_regclass('public.group_standings')` before assuming callable. SQL aggregates completed group matches; contains `ABD` in final status list, so abandoned matches may count as played. Qualification statuses are explicitly projections, not official tournament qualification. It inserts team_id NULL but ON CONFLICT references (league_code, season, group_name, team_id); null uniqueness and missing table issues require careful design. New media platform must preserve group standings *capability* with reliable provider-first and validated calculation fallback, not blindly reuse broken SQL.

### Monthly reset source cross-check
`app/api/admin/reset-monthly/route.ts` directly sets `monthly_points` and `monthly_correct_scores` to zero after admin token or cron key validation; it also leaves `eligible_monthly_*` counters unchanged. Thus both SQL reset function and app reset route share inconsistent rollover. No proof of schedule or active invocation; search all workflows.
 
### Next safe read-only SQL 20 (schema existence and triggers)
```sql
SELECT
 to_regclass('public.group_standings')::text AS group_standings_relation,
 to_regclass('public.user_predictions')::text AS user_predictions_relation;
SELECT n.nspname AS table_schema,c.relname AS table_name,t.tgname AS trigger_name,
 p.proname AS function_name,t.tgenabled AS enabled_state
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal
 AND (p.proname IN ('handle_new_user','handle_verification_update')
      OR c.relname='user_predictions')
ORDER BY n.nspname,c.relname,t.tgname;
```
Next: inspect public table defaults/constraints and insertion route before concluding whether eligibility field always null. Avoid selecting user records, personally identifying information or auth secrets.

### Operational target
A single authoritative competition period, explicit time zone, transactional selection of first N eligible predictions, immutable prediction timestamp and outcome, idempotent scoring and corrected counters, verified prize qualification and safe reset. A fresh zero-data launch is not a reason to skip these fixes.

## SQL 20 trigger attachments + direct prediction UI verification (2026-10-30)
- SQL 20 trigger result: `auth.users.on_auth_user_created` -> `handle_new_user` enabled 'O'; `auth.users.on_auth_user_updated` -> `handle_verification_update` enabled 'O'; `public.user_predictions.enforce_prediction_security` -> `secure_predictions` enabled 'O'. All are active in normal origin/local trigger mode.
- Thus Supabase signup and verification trigger wiring is **DB VERIFIED**, unlike earlier uncertainty. New auth migration must replicate both events and protect historical identity/entitlement obligations.
- `secure_prediction_insert` is absent from trigger attachments for any schema; its eligibility calculation is dormant as a trigger. **SOURCE VERIFIED:** `app/components/PredictionBoard.tsx` lines 96-106 sets `is_eligible_for_prize: false` explicitly on normal predictions. On this inspected insertion path, with no other trigger rewriting the flag, predictions remain ineligible for prizes. Check any other producer or RPC before generalizing across all pathways.
- **SOURCE VERIFIED:** `app/api/admin/run-audit/route.ts` filters `is_eligible_for_prize=true` and `points_awarded===10` (lines 45-56), so normal predictions submitted through the audited UI path would be excluded, and correct exact scores typically award 13, not 10. Multiple competition audit paths conflict.
- Earlier `app/admin/actions.ts` uses >=10 and a different candidate-count and period logic. All winner audits need a single explicit engine and regression suite.
- User supplied second SELECT (relation existence for `public.group_standings`) not present, so schema-drift concern is still UNVERIFIED.

## SQL 19 remaining body inspections
- `handle_new_user()` initializes profile from auth.users, with user role and zeros; now trigger attachment confirmed.
- `handle_verification_update()` promotes is_verified after email_confirmed_at transition; attachment confirmed.
- `audit_monthly_winners()` has exact-score `points_awarded=10` mismatch with 13-point combined outcome+score settlement, and diverges from TypeScript audit paths.
- `refresh_group_standings_from_matches()` writes to public.group_standings, absent initial inventory; verify relation exists before treating as operational. It counts ABD matches as finished and projects top-two rankings, requiring source/rules validation.

### Safe next data-free check
```sql
SELECT to_regclass('public.group_standings')::text AS group_standings_relation,
       to_regclass('public.user_predictions')::text AS user_predictions_relation;
```
Do not run privileged RPCs or try to repair production until approved and tests are in place.
