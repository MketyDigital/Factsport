# M15 — Legacy account, admin, settlement and automation audit

**Date:** 2026-11-07  
**Repository:** MketyDigital/Factsport  
**Branch:** refactor/factsport-v2  
**Status:** SOURCE AUDIT IN PROGRESS — behaviour inventory only; not a runtime migration.

This audit extends M14 by inspecting the legacy `main` branch account/admin routes, admin server actions, studio controls, settlement/matchmaker/live API routes, automation scripts and GitHub Actions schedules. It is not proof that scheduled jobs are currently healthy or that every referenced database function exists in production.

## Account and identity workflows

Source inspected:
- `app/auth/callback/route.ts`
- `app/auth/update-password/page.tsx`
- `app/forgot-password/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/components/AuthProvider.tsx`

Verified account surfaces/contracts:
- Supabase auth callback exchanges an authorization code for a session and supports a `next` redirect (default `/dashboard`).
- Password reset/update flow requires matching password and confirmation, enforces a six-character client minimum, calls Supabase `updateUser`, and returns to dashboard.
- Dashboard is a major signed-in destination and contains prediction/history and account/VIP-related experience; settings is a separate profile-management route.
- AuthProvider is the client-wide identity/profile/admin state source consumed by match chat and other signed-in features.

V2 parity work required:
- Inventory registration, email verification, password recovery, OAuth providers, session refresh, logout, account deletion/export, profile/avatar/username updates, notification and marketing preferences directly from every auth/dashboard component and Supabase trigger/policy.
- Preserve deep-link return destinations but validate them as same-origin relative paths; do not carry forward an open redirect risk.
- Enforce password policy server-side/provider-side, handle expired/used recovery links and session revocation, and test callback error states.
- Map legacy `profiles` fields and auth identities to V2 user/account/role/entitlement records without using email as an account merge key.
- Preserve user prediction history and profile display fields independently of free-prediction contact identity.
- Ensure role/entitlement changes propagate to sessions and cached authorization promptly.

## Admin command centre and security model

Source inspected:
- `app/admin/layout.tsx`
- `app/admin/actions.ts`
- `app/admin/page.tsx`
- `app/admin/users/page.tsx`, `UsersClient.tsx`
- `app/admin/matches/page.tsx`
- `app/admin/news/page.tsx`
- `app/admin/studio/page.tsx`, `StudioClient.tsx`, `actions.ts`
- `app/api/admin/users/route.ts`
- `app/api/admin/settings/route.ts`
- `app/admin/components/AdminCampaignManager.tsx`
- `app/components/ApproveButton.tsx`, `AuditManager.tsx`, `GameRulesManager.tsx`, `PromoSettingsManager.tsx`, `SocialSettingsManager.tsx`

Verified admin product functions:
- Admin access is layered in the legacy UI through a hardcoded email allowlist, a `profiles.role === 'admin'` check in the shared layout, and a separate 12-hour `admin_vault_unlocked` HttpOnly cookie obtained via an ADMIN_PIN action.
- Command centre handles pending VIP subscription authorizations and receipt review/approval.
- Dashboard provides promotion/global settings, campaign management, game rules, social settings, monthly audit, month reset and cleanup actions.
- Match Manager supports manual match management and data corrections; News Editor manages news content.
- User Directory searches/paginates profiles and toggles VIP status.
- Live Studio manages title, audio URL, video URL and active/inactive broadcast state, which controls the global `/live` page.
- Server-side admin APIs use Supabase service role for privileged changes.

Security and integrity gaps to address, not reproduce:
- Hardcoded admin email allowlists are duplicated across layout/pages/API handlers and can drift.
- `verifyAdminPin` compares a submitted PIN directly and sets a 12-hour cookie; source does not show throttling, lockout, attempt audit, CSRF binding or step-up reauthentication. The cookie value is a static boolean-like marker, not a signed/rotating authorization grant.
- `updateStudioSettings` uses the service-role client but the action itself does not independently authenticate the caller, verify the admin role or check the vault cookie. A server action must authorize itself; hiding its UI is not protection.
- `triggerAuditAction` also initializes service-role access without an explicit caller/session/vault authorization check in that action.
- VIP toggling checks email allowlist and vault cookie in the API but must also use centralized RBAC, validate target/action, enforce entitlement lifecycle and write an audit event.
- User page fetches all profiles with `select('*')`; V2 must minimize PII, paginate on the server and scope support access.
- Admin actions currently need a complete audit of CSRF/origin checks, rate limits, idempotency, actor attribution, approval dual-control and rollback for financial/entitlement changes.
- Payment proof URLs and transaction references are sensitive; protect access, retention and signed/private media delivery.
- Manual match editing must not overwrite provider-owned fields or silently break provider reconciliation; use field ownership and an audit diff.

V2 requirement: centralized server-only RBAC/permissions and step-up policy; every privileged server action independently authenticates and authorizes, records actor/action/target/reason/before-after metadata, and is idempotent where retryable. Remove hardcoded email lists and browser metadata role claims.

## VIP subscriptions, payment review and entitlements

Verified from command-centre subscription query and approval surface:
- Admin dashboard lists `subscriptions` with `status = pending`, joins customer profile, displays payment method, amount, transaction reference and proof URL, and exposes an approval action.
- User admin separately toggles legacy `profiles.is_vip`.
- Match analysis access in the previously audited M12 implementation still checks legacy `profiles.is_vip`.

Still to verify in deeper source pass:
- Full subscription submission UI, payment methods, proof upload/storage rules, duplicate transaction handling, rejection/refund, renewal, expiry and notification workflows.
- Whether approval updates subscription state, profile VIP, dates, receipt audit and user notifications atomically.
- VIP product tiers, duration, currency/FX, tax, failed payment and cancellation semantics.

V2 parity gates:
- Separate payment transaction state from entitlement state; use verified provider events or audited manual approval.
- Entitlements need explicit product, start/end, renewal, revocation, grace period, source, status and immutable audit history.
- Do not grant VIP solely from a mutable boolean or client-supplied payment reference.
- Reconcile subscriptions and entitlements in a transaction; idempotent duplicate approvals/webhooks; protect receipt access.
- Preserve historical subscription and prediction privileges through migration; do not infer them from email.

## Monthly champion audit and reward eligibility

Source inspected: `app/admin/actions.ts`, `app/api/admin/run-audit` and `monthly-audit.yml`.

Verified legacy audit rules from `triggerAuditAction`:
- Reads `target_exact_scores` (fallback 4) and `min_points_floor` (fallback 100) from site settings.
- Ranks top five profiles by `eligible_monthly_points`.
- Checks VIP status and points floor, at least three distinct calendar weeks with qualifying predictions (`points_awarded >= 10`), league diversity threshold, at least one home win/draw/away win predicted, and score variety with at most one 0-0.
- Removes previous unapproved rows for the same month and inserts a monthly_winners row per top-five user with rank, points, prize label and a JSON audit report.
- Monthly GitHub workflow invokes `/api/admin/run-audit?key=CRON_KEY` on the first day of each month.

Risks and V2 requirements:
- Audit source has fallback settings and legacy prize labels; preserve the exact rule version and effective settings for each audit run.
- The visible code deletes prior unapproved rows and inserts new rows; retries/concurrency need a unique run key and transaction to avoid duplicates or partial result sets.
- A fixed top-five candidate list may exclude a lower-ranked user who meets qualification if a higher-ranked user fails; confirm whether this is intentional business policy before implementing.
- Calendar week calculation and month boundary use runtime locale/timezone; define canonical competition timezone and month window.
- Prize approval/payment/dispute/reversal and audit evidence must be explicit workflows, not just a JSON report.
- Do not silently change threshold, qualification or ranking semantics in migration.

## Settlement and leaderboard lifecycle

Source inspected: `app/api/settle/route.ts`, `scripts/generate-pro-slips.js`, `scripts/daily-summary.js`.

Verified settlement route:
- GET endpoint checks `key` query parameter against `CRON_KEY`.
- Uses service role, selects at most 10 matches with status in `FT`, `FINISHED`, `ABD` and `points_distributed = false`.
- Calls database RPC `settle_match_points(target_match_id)` for each match.
- On RPC success marks match `points_distributed = true`; failures are logged and processing continues.
- Returns settled count, matches found and per-match logs.

Risks and V2 requirements:
- GET query-secret authentication can leak via URL logs/history; use POST with authorization header, constant-time secret validation or signed job identity, plus replay protection.
- Status list omits other terminal statuses used elsewhere (e.g. AET, PEN, AWARDED); confirm the intended settlement eligibility for each status.
- RPC success and marking the match distributed are separate operations; a crash between them can cause repeated settlement. The settlement function must be idempotent and settlement ledger rows uniquely keyed by match/user/rule.
- A 10-match batch requires a durable cursor/claim/lease so backlogs drain and concurrent workers cannot settle the same match simultaneously.
- Need correction/re-settlement semantics for provider score reversals, abandoned/awarded matches and penalty shootout outcomes.
- Verify the SQL function's points logic, prediction status transitions, monthly eligible point counters, leaderboard updates, campaign bonus scoring and transaction boundaries before porting.

## Fixture ingestion, ESPN reconciliation and live refresh

Source inspected:
- `app/api/live/route.ts`
- `app/api/matchmaker/route.ts`
- `scripts/fetch-espn-cups.js`
- `scripts/sync-gh.js`
- `.github/workflows/schedule.yml`, `matchmaker.yml`

Verified legacy operations:
- Main Football-Data sync runs every 12 hours; ESPN cup sync runs in the same scheduled workflow.
- ESPN cup sync covers a rolling -3 to +35 day window, a hardcoded competition code list including domestic cups, Copa America, AFCON, friendlies, Nations League and World Cup qualifiers.
- Cup sync filters youth/esports/women matches, reconciles changed ESPN IDs by exact team names among selected pending states, and upserts by `api_id`.
- Matchmaker runs twice daily (06:00 and 12:00 UTC), calls production `/api/matchmaker` with CRON_KEY, and maps provider identities using a large alias dictionary.
- Live refresh endpoint uses service role, a ±time window (-24h to +2h), fetches ESPN scoreboard and detail data, and updates status, score, display clock, events, stats, lineups, venue, stage/group, referees and related fields. It also uses an in-memory edge map for score-change tracking.
- Matchmaker and live refresh are separate from client-side live API fetch/deduplicator and have different responsibilities.

V2 parity gates:
- Preserve the competition/provider mapping inventory and team aliases as versioned data, not a lossy rewrite.
- Use canonical provider event IDs plus reviewed identity reconciliation; never remap on exact display-name match alone.
- Preserve fixture window, postponed/rescheduled logic, terminal status semantics, event/stat/lineup payload richness and provider freshness.
- Use durable KV/queue/DB leases rather than process-local Map for cross-instance deduplication.
- Add replay-safe ingestion, per-provider backoff/circuit breaker, stale-data markers, raw payload archive, conflict audit and dead-letter handling.
- Ensure no production matchmaker route is called by V2 staging tests.

## Editorial and social automation

Source inspected:
- `.github/workflows/allInOne.yml`
- `scripts/daily-preview.js`
- `scripts/daily-summary.js`

Verified scheduled jobs:
- Pro AI analysis script is scheduled hourly 02:00–12:00 UTC.
- Daily preview scheduled at 08:00 UTC.
- Daily matchday summary scheduled at 22:40 UTC.
- Manual dispatch offers pro-slips, morning-preview, evening-summary and run-all-safely options.
- Scripts read social publishing configuration from `site_settings.social_config`, including credential and event/channel settings.
- Daily summary selects finished matches for the UTC day (with a before-06:00 UTC previous-day adjustment), creates one `matchday-roundup-YYYY-MM-DD` news item if absent, uses only DB scores/events in its AI prompt, and inserts the resulting article with match shortcode context.
- Social distribution includes Telegram and Buffer integrations; morning preview also integrates external automation/webhook delivery.

V2 requirements:
- Preserve editorial scheduling, matchday timezone rules, social channel routing, content templates, duplicate suppression and manual rerun controls.
- AI-generated content must be grounded in stored match facts, reviewed/flagged where needed, and never auto-publish unsupported claims.
- Make each job idempotent with durable run records, lock/lease, retry policy, dead-letter queue and operator-visible status.
- Keep social credentials in secret storage, not JSON settings exposed to public projections.
- Add publication history, per-channel success/failure, retries and safe replay. A news insert alone is not proof that all social posts succeeded.

## Critical cross-cutting automation defects / migration cautions

- The legacy all-in-one workflow has overlapping schedule triggers at 08:00 UTC (hourly Pro AI and daily preview); ensure intentional concurrency/quotas and separate job locks.
- `matchmaker.yml` and settlement/audit HTTP routes put CRON_KEY in query strings; migrate to header-based or signed invocation and scrub logs.
- Legacy scheduled workflows call production URLs; V2 CI/staging must never reuse these URLs or secrets.
- Service-role scripts and server actions need narrow credentials and auditable scopes; never put service-role access in browser code.
- Process-local in-memory caches are not durable across edge isolates.
- GitHub workflow schedules can be delayed or disabled; operations need heartbeat/last-success monitoring and manual replay.
- Monthly audit, settlement, prediction settlement, leaderboard updates and social publication are business-critical jobs and require independent observability.

## Still open

- Inspect full payment/subscription creation, approval, expiry and cancellation code.
- Read database SQL functions/triggers for `settle_match_points`, profile counters, campaign scoring, reset-monthly and cleanup actions.
- Fully inspect admin match editor and news editor save/publish/revision semantics, plus all admin API routes.
- Complete `generate-pro-slips.js` input filters, analysis output, risk limits, schedule behaviour and VIP delivery.
- Audit OAuth providers, login/register flows, email templates, account deletion and all profile settings.
- Compare every one of these contracts against V2 schema, APIs and tests; no V2 feature is parity-complete solely because this source audit has documented it.

## Cutover policy

Keep production feature flags and scheduled V2 jobs disabled until domain rules, permissions, data migration, idempotency, replay, observability, staging E2E and rollback are proven. This document does not authorize production calls, data writes, secret changes, DNS/Worker routing or migration application.
