# Factsport full-system audit — legacy + v2

**Date:** 2026-11-06  
**Repository:** `MketyDigital/Factsport`  
**Audited refs:** `main` and `refactor/factsport-v2`  
**Intent:** Cloudflare is the only hosting/deployment platform. No Vercel deployment, account, build or routing dependency is part of the target architecture.

## Executive status

This was a source/configuration and GitHub Actions audit. It is not a live Cloudflare account audit, production database penetration test, or a browser/end-to-end test. No production database records, credentials, DNS records, or production Worker settings were changed.

- The legacy `main` application and its scheduled workflows are still active. The 2026-11-06 scheduled match-sync and daily matrix runs both completed successfully.
- The v2 native vinext build and protected Cloudflare staging deployment passed on commit `9ccbdc745179304a829d43c95038478258e75ca8`. That staging run checked unauthenticated denial, the staging health endpoint, Hyperdrive and R2, and a populated matches API.
- After the Cloudflare-only source cleanup, the latest code commit `8c54a9060e6e011fa887f12b5cf546cc2c55c71b` passed the native vinext build and protected Cloudflare staging deployment on 2026-11-06: [build 42172478877](https://github.com/MketyDigital/Factsport/actions/runs/42172478877), [staging 42172478876](https://github.com/MketyDigital/Factsport/actions/runs/42172478876). The later branch commits only update audit documentation.
- No open pull request was found. The repository's `Protect main` ruleset is **disabled**, and the branch endpoint reports `main` is not protected. This removes an important release safeguard.
- The v2 schema is a first slice, not a complete replacement for the legacy product. Most account, prediction, prize, content, social and admin paths still rely on legacy Supabase code.
- The legacy database security audit remains unresolved; see `docs/audit/SEC-001-supabase-rls.md`.

## Cloudflare-only correction

Removed stale Vercel-specific development-host checks from `middleware.ts` on both `main` and `refactor/factsport-v2`. The development-host check now recognizes Cloudflare Pages preview hosts only. Reworded the old Vercel build comment in `app/api/evening-roundup/route.ts` on both refs.

This is source cleanup, not proof that Cloudflare production configuration is correct. No Vercel deployment was found in the inspected workflow definitions. The legacy project still contains a Cloudflare Pages adapter (`@cloudflare/next-on-pages`); that is a Cloudflare tool, not a Vercel dependency.

## Findings — prioritize before expanding v2

### P0 — Legacy database authorization and secret exposure risk

The existing `SEC-001-supabase-rls.md` audit records user-supplied SQL metadata showing:
- public SELECT policies and grants across sensitive `profiles`, `site_settings` and `user_predictions` data;
- an authenticated permissive ALL policy on `subscriptions`;
- SELECT grants covering sensitive profile/payment/config columns, including `site_settings.social_config`.

This is a database-authorization exposure at the policy/grant layer. External exploitability depends on API schema exposure/network access and was not tested here. Treat social/webhook credentials formerly stored in `site_settings.social_config` as potentially exposed until verified and rotated. Do not copy or print their values. This is a release blocker for any return to the legacy database-backed product.

### P1 — Legacy score ingestion can write false 0–0 scores

`app/api/sync-fd/route.ts` maps nullable football-data `score.fullTime` values with `?? 0`. During a live match those values can be null; the route can then treat null as a real zero and write it for an unlinked fixture. Preserve null/unknown and update only when the provider supplies a valid score. Add tests for live, halftime, postponed, finished and missing-score payloads before changing this route.

### P1 — Legacy live-update deduplication is not durable

`app/api/live/route.ts` uses a module-level in-memory `Map` as its deduplication store. Edge isolates can restart or run in parallel, so it cannot guarantee cross-instance idempotency. It fires the social side effect asynchronously before the database update is confirmed, then performs the match update separately. This can lose or duplicate posts and makes retry behavior hard to prove. Move event idempotency and an outbox/dispatch record into durable storage before porting this behavior.

### P1 — Monthly champion audit can draft unqualified/duplicate-rank candidates

`app/api/admin/run-audit/route.ts` pushes every examined user into `draftWinners`, even when `isFullyQualified` is false. The rank increments only for a passing user, so a failed candidate and a later passing candidate can both be drafted with the same rank and prize amount. Confirm intended review workflow; then either draft only qualified winners or explicitly model rejected candidates separately with no prize/rank. Add deterministic tests for fail/pass ordering, ties, and fewer than three qualifiers.

### P1 — Settlement atomicity is not proven

`app/api/settle/route.ts` calls `settle_match_points` and then separately sets `matches.points_distributed = true`. The function definition and transaction/idempotency behavior were not available in this source audit. If the RPC awards points but the flag update fails, a retry may award twice unless the function itself is transactionally idempotent. Verify the SQL function and add replay/concurrency tests before porting settlement.

### P1 — The vault PIN cookie is a reusable unsigned boolean

`verifyAdminPin()` sets `admin_vault_unlocked=true` for 12 hours. It is HttpOnly and Secure in production, which helps against script access, but it is not signed, bound to the authenticated user/session, or backed by server-side step-up state. API routes also check only the cookie value after their own email check. A caller holding an allowlisted admin session can manually supply the static cookie value and bypass the intended PIN step-up. Replace it with a short-lived signed/session-bound step-up assertion or server-side nonce, and enforce it inside every privileged handler/action. Add expiry, revocation and failed-attempt rate limiting.

### P1 — Production automation is still legacy and Supabase-coupled

The active `main` workflows `schedule.yml`, `matchmaker.yml`, `allInOne.yml` and `monthly-audit.yml` continue to execute on GitHub-hosted runners and/or call `https://factsport.com/api/...`. They inject the Supabase service-role key into scripts and retain the legacy cron/API model. This is not Vercel, but it is not yet the v2 Cloudflare Worker scheduler either. Keep these legacy jobs running only as long as the current production system depends on them; do not enable equivalent v2 jobs against production until data ownership, idempotency and cutover are verified.

### P1 — v2 is not yet a full application/data migration

The v2 migration `db/migrations/0001_factsport_core.sql` creates only `matches`, `app_users`, `external_identities` and `job_runs`. The existing app still contains Supabase clients and many routes/components that depend on legacy tables and service-role access. The v2 contracts in `lib/ports/contracts.ts` are design interfaces, not a completed implementation.

Missing/unfinished migration domains include user identity/session lifecycle, profiles and roles, subscriptions/VIP entitlements, predictions and scoring, settlement/prize audit, news/editorial, social publishing, settings/secrets, media migration and admin RBAC. The current v2 staging smoke test proves the protected Worker, Hyperdrive, R2 and a populated matches read—not feature parity across these domains.

### P1 — Main branch release protection is disabled

GitHub reports the `Protect main` ruleset enforcement is disabled; the `main` branch protection endpoint reports protection disabled. No open PR was found. Enable required CI checks, prohibit force pushes/deletions, and require review before merging production changes. Keep v2 work in its branch until an explicit cutover plan is approved.

### P2 — Read-only ESPN preview uses a writer identity

`workers/factsport-espn-score-preview.mjs` contains SELECT-only application logic, but connects as `factsport_v2_espn_writer`. The role is intentionally provisioned for ESPN writer duties, so code-level absence of UPDATE statements is not the same as database-enforced read-only access. Give preview-only tools a dedicated SELECT-only role/Hyperdrive, and reserve the writer credential for a separately reviewed score-writer.

### P2 — Cloudflare staging tokens and temporary workers need lifecycle controls

The staging workflows generate high-entropy tokens and deploy isolated Workers. The source does not demonstrate automatic token expiry or cleanup of every temporary Worker/secret after a successful run. Define retention, rotation and cleanup explicitly; keep staging Workers inaccessible without the token and never bind production routes.

### P2 — CI is not a complete quality gate

The current v2 workflow has passing engine tests, ingestion tests, TypeScript and vinext build. It does not run a lint gate, browser/e2e route matrix, authorization integration suite, settlement replay/concurrency suite, provider contract tests against recorded fixtures, or load/rate-limit tests. CI uses `npm install` rather than deterministic `npm ci`. Add lockfile-based installs and staged quality gates.

### P2 — CORS headers are not an API security boundary

`next.config.mjs` sets `Access-Control-Allow-Origin` for API routes, but CORS is not authentication or CSRF protection, and the config does not itself implement a deliberate preflight/credential policy. Audit each write route for authentication, authorization, origin/CSRF protections and method restrictions independently.

## Current deployment and runtime boundaries

- Cloudflare v2 staging Worker: verified on the recorded successful run above; the latest v2 source cleanup needs a fresh pass.
- Cloudflare R2 staging binding: verified in staging health/smoke flow; no bulk legacy media migration is complete.
- PostgreSQL: v2 connects through Cloudflare Hyperdrive. The release documentation describes the PostgreSQL 18 database as Azure-hosted. Hyperdrive is Cloudflare's connection layer; it does not mean the database itself is hosted by Cloudflare.
- v2 scheduled fixture worker: a Cloudflare Cron is documented as registered, but the release document says actual scheduled invocation/automatic refresh remains unverified.
- ESPN reconciliation: prior read-only preview found 18 candidate links; no links were written. The score-parity preview is a preview only, not a live score updater.
- Production Cloudflare Pages/Workers dashboard, routes, DNS, secrets, Durable Objects/KV, WAF, rate limits, logs and analytics were not accessible through the repository audit. These require a read-only Cloudflare account inspection.

## Remediation order

1. Verify and contain legacy Supabase RLS/grant exposure; rotate any potentially exposed social/webhook credentials.
2. Fix and test legacy score null handling, live-event idempotency/outbox, champion audit ranking and settlement transaction semantics.
3. Enable GitHub main protection and required CI.
4. Create a complete v2 domain/data migration matrix and map every legacy route/table to a v2 owner, API, policy and test.
5. Give read-only previews read-only database credentials; formalize staging token and Worker cleanup.
6. Complete auth, entitlements, predictions, settlement, editorial/social, media and admin parity in staging.
7. Prove Cloudflare Cron execution, provider failure/retry behavior, load and security; then plan a controlled production cutover and retire legacy GitHub/Supabase automation only after parity.

## Architecture decision to confirm

Current v2 configuration is Cloudflare Workers + Hyperdrive + R2, with PostgreSQL 18 documented as Azure-hosted behind Hyperdrive. Confirm whether the target is **Cloudflare for app/runtime/deployment while keeping PostgreSQL external**, or whether the database itself must also move to a Cloudflare-managed database. Do not silently substitute D1 for PostgreSQL; the schema and adapters are PostgreSQL-specific.


---

## v2 deep audit addendum — 2026-11-06

This section supersedes older deployment-status statements above where the branch has since advanced. It is a source/configuration review plus recorded GitHub Actions evidence; it is not yet a live Cloudflare account or Azure firewall inspection.

### Documentation and plan inventory

The inspected v2 documentation includes this full-system audit, `docs/audit/SEC-001-supabase-rls.md`, and `docs/implementation/CF-001-github-staging-r2.md`. Conventional root/docs README, roadmap, plan, v2 plan, and release-runbook paths queried during this pass were absent. No separate, authoritative end-to-end v2 roadmap/cutover checklist was found in those paths. Until a canonical roadmap is added, the implementation note plus this audit are the current recorded constraints; they are not a substitute for a domain-by-domain migration plan.

### Confirmed Cloudflare-only source topology

- The v2 app uses Cloudflare's Vite plugin, vinext, `cloudflare.config.ts`, and Worker `factsport-v2-staging`. It has no production domain/route binding in the checked-in config.
- The app and DB/R2 smoke configs both reference Hyperdrive ID `895cca4c06104b8ab9f7c1b72a8ba18f`.
- The schedule fixture Worker config references a separate Hyperdrive ID `eb634fef8bb443839fd0847c6c370f85`, and Cron `15 3,15 * * *` UTC.
- The ESPN preview Worker source expects identity `factsport_v2_espn_writer`, but no matching deployment config/workflow was found in the inspected paths.
- The older implementation note lists Hyperdrive ID `08cee41a81be4c3980450be9563af5e2`. This ID is not referenced by the current app, smoke, or schedule config files inspected. It may be historical or an additional resource; do not delete it without account inventory.
- `infra/cloudflare/configure-factsport-hyperdrive.sh` validates the resource at ID `895cca...` against expected name, database `factsport_v2`, origin user `factsport_v2_reader`, and Azure hostname before it optionally disables caching and sets origin connection limit to five. This is a workflow-side configuration check, not proof of effective PostgreSQL grants or Azure firewall rules.
- The implementation note's older claim that only the smoke Worker is deployed and the app staging Worker is not deployed is superseded by the later app-staging workflow and run below. The older statement that the Hyperdrive connection uses a bootstrap administrator also conflicts with the current verification script's expected `factsport_v2_reader`; account-side identity must be checked rather than assuming either statement is current.

### Database network and authorization boundary

The owner states the PostgreSQL endpoint is public-addressed but its firewall permits only Cloudflare IP ranges. The implementation note records 15 shared Cloudflare ranges and correctly warns these are not Factsport-exclusive IPs. This audit has not read the live Azure firewall rules. A shared Cloudflare egress allowlist is a network filter, not a per-Worker identity boundary; TLS, unique strong credentials, rotation, and narrow database roles remain mandatory.

The v2 migration `0001_factsport_core.sql` defines only `matches`, `app_users`, `external_identities`, and `job_runs`. It does not define the application role model, database role creation, grants, row/column privileges, or the product tables needed for account, predictions, subscriptions, settlement, content, social, or admin. Those controls must be supplied by reviewed database/infrastructure migrations and verified against effective privileges before cutover.

The app reader, schedule writer, and ESPN preview identities are separate in source/config expectations. The schedule Worker checks that its identity cannot DELETE matches or UPDATE score columns, but it does not prove that all other sensitive columns are protected from UPDATE. Inspect effective table and column grants for every identity. The ESPN preview Worker performs SELECT queries but uses a writer-named identity; move it to a dedicated database-enforced SELECT-only role. Do not treat "no UPDATE statement in this file" as least privilege.

### Staging scope and proof

- Build/test run [42172478877](https://github.com/MketyDigital/Factsport/actions/runs/42172478877) passed the engine regression suite, ingestion/reconciliation/preview tests, preview Worker syntax check, TypeScript, and native Cloudflare vinext build.
- Full app staging run [42172478876](https://github.com/MketyDigital/Factsport/actions/runs/42172478876) passed credential presence validation, regression tests, TypeScript, native Worker build, isolated staging deployment, unauthenticated denial for `/`, `/api/matches`, and `/admin`, authorized staging health, Hyperdrive/R2 dependency checks, and a populated PostgreSQL matches response.
- The app-staging workflow supplies placeholder Supabase URL/key values at build time. Middleware's staging token gate protects all matched paths, but only `/api/v2/health` and `/api/matches` bypass legacy Supabase auth after the gate. The recorded tests do not prove that other authorized app routes work. Login, account management, admin, VIP/payment, predictions, settlement, editorial, social, and media flows remain unverified/incomplete.
- The schedule Worker config contains the twice-daily Cron declaration, but no GitHub deployment workflow for it was found in the inspected paths. The source and Cron expression do not prove the Worker is deployed, the trigger is active, or scheduled runs are succeeding. Verify the live Worker, trigger, last invocations and logs through Cloudflare.
- The ESPN preview source is a dry-run with `writesPerformed: 0`; prior notes record 18 candidate links and no writes. No score-writer is authorized by this audit.
- Staging access tokens are generated per deployment and stored as Worker secrets. They are not time-expiring in source, and workflows do not automatically delete staging Workers after tests. Define retention, expiry/rotation and cleanup.

### Cloudflare status residue

A GitHub commit-status query for v2 commit `8c54a9060e6e011fa887f12b5cf546cc2c55c71b` returned a failing status context named `Vercel` with a Vercel target URL. No Vercel workflow/config was found in the inspected v2 workflow files; the current v2 build and deploy workflows use Cloudflare. Treat this as stale external GitHub status integration until repository settings are inspected, and remove that obsolete integration if it is no longer used. It is not proof of the current deployment target.

### Cutover blockers from this v2 pass

1. Reconcile the three Hyperdrive IDs in source/docs/account inventory; verify the actual app and scheduler origin users without exposing connection strings.
2. Verify live Azure firewall rules match the intended Cloudflare ranges; document how range updates are maintained. Confirm TLS and effective least-privilege grants for reader, schedule writer, and preview identities.
3. Complete and test the full database schema and role/grant migrations. No production data migration or production schema change is authorized by this audit.
4. Deploy/verify the schedule Worker only in staging, prove Cron invocations and provider failure/retry behavior, and record job-run observability/idempotency. Keep it away from production data until a cutover plan approves it.
5. Replace ESPN preview writer identity with a SELECT-only role and test its privileges.
6. Complete the full product domain/route migration matrix and staging parity tests. Matches read parity alone is not sufficient.
7. Add deterministic install/CI gates, auth/authorization integration tests, DB replay/concurrency tests, browser/e2e coverage, and load/rate-limit checks.
8. Add an authoritative v2 roadmap and cutover/rollback runbook, including data freeze/dual-run rules, reconciliation, DNS/route switch, monitoring, and legacy automation retirement.
9. Remove stale Vercel status integration metadata so required checks reflect Cloudflare-only deployment.

No production DNS, routes, Worker settings, database records, database credentials, or production jobs were changed by this audit.


## Documentation inventory correction — 2026-11-06

A prior v2 addendum said no standalone roadmap/release documentation was found in conventional paths. That statement was incomplete: a recursive repository tree inspection located and reviewed the authoritative `docs/audit/ROADMAP.md`, `docs/audit/handoffs/M00.md`, the database/sports/security/media/provider audit notes, and the implementation notes under `docs/implementation/`. The roadmap is the governing modernization plan; it must not be replaced by this audit. A separate `docs/audit/PRODUCTION-EXECUTION-PLAN.md` now translates its milestones into ordered production delivery workstreams and cutover acceptance gates.

The Cloudflare Hyperdrive ID discrepancy is also resolved by historical workflow evidence: the one-time runtime DB setup created `factsport-v2-runtime-postgres` ID `895cca...` from the original admin Hyperdrive `08cee4...`, then verified the restricted reader connection. The schedule and ESPN Hyperdrives are separate purpose-specific writer connections. See the new production execution plan for exact identities and run links.

The app-staging matches endpoint was also found to return a public cache header while staging required a token header. The v2 route now returns private/no-store for staging, and the app-staging workflow now checks cache headers plus authorized/unauthorized request ordering. The updated workflow run must pass before this correction is marked runtime verified.


## ESPN preview privilege correction — 2026-11-06

The earlier audit finding that the ESPN preview used `factsport_v2_espn_writer` is superseded by the latest v2 branch changes. Both the reconciliation preview and score-parity preview now verify and use the existing read-only `factsport_v2_reader` runtime Hyperdrive (`895cca...`). The dedicated ESPN writer Hyperdrive remains reserved for a future score updater. The preview workflow now checks the exact runtime resource and reader identity before deployment. A fresh preview run is required to mark this runtime correction verified.


## Staging infrastructure and PostgreSQL role audit — 2026-11-06

### Cloudflare staging controls verified

- App matches cache isolation passed: [42259985117](https://github.com/MketyDigital/Factsport/actions/runs/42259985117) tested authenticated request → unauthenticated request to the same URL → authenticated request; staging responses remain `private, no-store`.
- Runtime Hyperdrive and R2 privacy/TLS gate passed: [42262051142](https://github.com/MketyDigital/Factsport/actions/runs/42262051142). The runtime Hyperdrive identity matched `factsport_v2` / `factsport_v2_reader`, TLS mode was `require`, query cache was disabled, origin connection limit was five, DB probe passed, R2 managed `r2.dev` access was disabled, no custom domain was enabled, and R2 probe passed.
- Schedule Worker strict-role/Cron deployment passed: [42264186975](https://github.com/MketyDigital/Factsport/actions/runs/42264186975). It verified the schedule role cannot insert/update scores or change settlement state and has no role inheritance with a five-connection limit. Cron is registered at 03:15 and 15:15 UTC; actual scheduled invocation history still needs observation.
- ESPN writer strict-role verifier passed: [42264640003](https://github.com/MketyDigital/Factsport/actions/runs/42264640003). It confirmed the writer's limited live-field permissions, no private-table access, no role inheritance and five-connection limit.
- ESPN reconciliation preview uses the read-only runtime reader and passed: [42260972600](https://github.com/MketyDigital/Factsport/actions/runs/42260972600), with 20 unique candidates and zero writes.

### Effective PostgreSQL staging privileges

A read-only catalog audit through a temporary Cloudflare Worker completed successfully. It connected as `mketydbadmin` to `factsport_v2`; the database owner is `mketydbadmin`. No credentials or private row data were retrieved.

- All three runtime roles (`factsport_v2_reader`, `factsport_v2_schedule_writer`, `factsport_v2_espn_writer`) are LOGIN roles, non-superuser, cannot create databases/roles, cannot replicate, cannot bypass RLS, have `NOINHERIT`, and have connection limit 5.
- No role memberships exist for these runtime roles.
- Table-level rights are SELECT on `public.matches` only; no table-level INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, and no rights on `app_users`, `external_identities` or `job_runs`.
- Reader has no match-column INSERT or UPDATE privileges.
- Schedule writer can insert/update fixture schedule fields only; it no longer has score INSERT or UPDATE, cannot update `points_distributed`, and cannot update `espn_id`.
- ESPN writer can update only `away_score`, `espn_id`, `home_score`, `match_events`, `source_updated_at`, `stats`, `status`, `updated_at` and `version`; it cannot alter team names, kickoff, settlement, insert rows or delete rows.
- All three roles have CONNECT and schema USAGE, but no database CREATE or schema CREATE.
- No executable functions or usable sequences in the public schema are granted to these roles.

The audit observed the default database TEMP privilege inherited from PUBLIC. The database owner is confirmed as `mketydbadmin`; a separate idempotent hardening run is currently verifying removal of this unnecessary TEMP privilege. Until that rerun passes, record TEMP as a residual default privilege; runtime Workers do not use temporary tables.

The staging-only hardening SQL is recorded in `db/migrations/0002_factsport_v2_runtime_role_hardening.sql`. The successful first hardening run [42263796103](https://github.com/MketyDigital/Factsport/actions/runs/42263796103) applied NOINHERIT, five-connection limits and removed the schedule writer's score INSERT grants. A follow-up is testing the database TEMP revocation. No production DB role or grant was changed.

### Route and UI migration inventories

Added:
- [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md) — 25 API routes and privileged server actions.
- [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md) — public, auth, dashboard, VIP, admin, editorial, sports and legal pages plus required user journeys.
- [COMPONENT-MIGRATION-MATRIX.md](./COMPONENT-MIGRATION-MATRIX.md) — direct Supabase dependencies found in 54 shared component files, including 14 direct Supabase consumers.

These inventories make clear that only the matches API and protected health endpoint are proven on the v2 runtime. The rest of the application is not feature-complete.
