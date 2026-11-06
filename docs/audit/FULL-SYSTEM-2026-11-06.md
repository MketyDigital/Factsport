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
