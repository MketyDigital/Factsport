# Factsport v2 — production execution plan and cutover gates

**Branch:** `refactor/factsport-v2`  
**Plan owner:** Factsport maintainer  
**Updated:** 2026-11-06  
**Status:** Staging foundation exists; product migration is in progress. **Not production-ready.**

This plan operationalizes `docs/audit/ROADMAP.md`, the handoffs under `docs/audit/handoffs/`, the clean-reset policy, provider decisions, and the implementation notes. The master roadmap remains authoritative for product scope. This document is the ordered engineering execution and release checklist. It is intentionally not a list of smoke tests: each phase must deliver working product capability, durable data semantics, operational ownership, and rollback.

## 1. Architecture decisions to preserve

| Concern | Production target |
|---|---|
| Web application, APIs and frontend live proxy | Cloudflare Workers using vinext; one centrally managed Factsport deployment with modular routes |
| Primary database | Azure Database for PostgreSQL Flexible Server, database `factsport_v2`, reached only server-side through Cloudflare Hyperdrive |
| Database ingress | Public endpoint restricted to the owner's 15 available Cloudflare IP ranges; owner confirms this is the intended/only available allowlist and accepts the shared Cloudflare egress boundary; TLS required; do not widen ingress |
| Runtime database identity | Dedicated read-only `factsport_v2_reader`; never use bootstrap/admin credentials for app requests |
| Background writers | Separate narrowly scoped PostgreSQL roles/Hyperdrive per job class; no shared omnipotent worker identity |
| Object/media storage | Private Cloudflare R2 behind a MediaStore adapter; public delivery only through reviewed object policies/custom routes |
| Fast live match UX | Preserve ESPN-first matched live data and 3-second frontend refresh/cache; don't route every viewer poll through PostgreSQL or Logic Apps |
| Fixture coverage | football-data.org is primary for its accessible free-tier fixtures; ESPN fills coverage gaps |
| Live/final precedence | ESPN is preferred fast LIVE source for linked fixtures; football-data.org serves unmatched fixtures and FT verification; approved conditional fallback only on independently verified ESPN upstream degradation |
| Automation | Application-owned JobRunner + durable run keys/idempotency; Azure Logic Apps Consumption is the selected third-party automation orchestrator; Cloudflare scheduler alternative remains disabled unless deliberately selected for a job |
| Social | Facebook Graph API and Telegram Bot API remain direct first-party integrations; Buffer/Make-type third-party distribution may use Logic Apps |
| AI and transactional email | Mkety AI and Mkety Mail behind server-only replaceable adapters; every AI article remains review-gated |
| Identity | Factsport-owned immutable user IDs, roles and entitlements; OIDC/Auth provider behind an adapter. Final provider and tenant configuration remain a release decision; do not assume Entra or shared Mkety Auth is live |
| Legacy operational data | Clean start for matches, scores, events, predictions, points, rankings and transient logs; preserve accounts/paid obligations and authored editorial assets only after explicit review |

Do not silently replace PostgreSQL with D1. Do not make a provider change that breaks stable internal match IDs, prediction references, authored article slugs, or paid entitlement obligations.

## 2. Existing infrastructure: verified evidence

### Cloudflare and database resources

| Resource | Verified identity | Intended use |
|---|---|---|
| Original admin Hyperdrive | `factsport-v2-postgres`, `08cee41a81be4c3980450be9563af5e2` | Controlled migrations/bootstrap only |
| Runtime Hyperdrive | `factsport-v2-runtime-postgres`, `895cca4c06104b8ab9f7c1b72a8ba18f` | App reader; TLS, cache disabled, origin pool 5 |
| Schedule Hyperdrive | `factsport-v2-schedule-postgres`, `eb634fef8bb443839fd0847c6c370f85` | Schedule-only fixture writer |
| ESPN Hyperdrive | `factsport-v2-espn-postgres`, `c5166b8496624a80a0a77c750585c271` | ESPN live-field writer; never settlement |
| App staging Worker | `factsport-v2-staging` | Protected vinext staging app |
| DB/R2 smoke Worker | `factsport-v2-db-smoke` | Protected, read-only dependency probe |
| Schedule Worker | `factsport-v2-schedule-sync` | Staging fixture import, twice-daily UTC Cron |
| Media bucket | `factsport-v2-media-staging` | Private R2 staging bucket |

The original admin Hyperdrive is intentionally different from the runtime Hyperdrive. The one-time setup workflow read the existing `DATABASE_URL` GitHub secret only inside Actions, verified its target identity without printing it, used a temporary Cloudflare Worker to create a random-password `factsport_v2_reader`, created runtime Hyperdrive `895cca...`, verified a connection using that identity, and removed temporary bootstrap/check Workers. It did **not** place the database URL into the application Worker. The app binds the resulting restricted Hyperdrive ID directly.

Evidence:
- Runtime reader provisioning: [41675097638](https://github.com/MketyDigital/Factsport/actions/runs/41675097638)
- Schedule writer + initial PL import: [41695514082](https://github.com/MketyDigital/Factsport/actions/runs/41695514082)
- Schedule Cron registration and protected health: [41696849300](https://github.com/MketyDigital/Factsport/actions/runs/41696849300)
- ESPN writer provisioning: [42046871411](https://github.com/MketyDigital/Factsport/actions/runs/42046871411)
- ESPN writer positive/negative privilege verification: [42047371419](https://github.com/MketyDigital/Factsport/actions/runs/42047371419)
- ESPN dry-run reconciliation preview: [42050234345](https://github.com/MketyDigital/Factsport/actions/runs/42050234345)
- Latest recorded app staging: [42172478876](https://github.com/MketyDigital/Factsport/actions/runs/42172478876)
- Latest recorded Hyperdrive/R2 smoke: [42175276021](https://github.com/MketyDigital/Factsport/actions/runs/42175276021)

These are staging results, not production cutover approval. The schedule Cron is registered, but actual automatic scheduled invocation and refresh have not yet been observed in the recorded evidence. The ESPN preview is read-only and no match links or scores were written.

### Immediate code correction in progress

The staging app's `/api/matches` response previously used `Cache-Control: public, s-maxage=60` despite requiring a staging access-token header. That could allow an intermediary configured to cache the route to reuse a protected response. The v2 branch now emits `private, no-store, max-age=0` in staging while retaining the production public cache policy. The app-staging workflow is being extended to assert the header, test an unauthenticated request after an authorized one, and then re-test authorized access.

## 3. Ordered delivery workstreams

### P0 — Foundation and release controls

- [ ] Pin an immutable legacy baseline and record exact branch/commit ancestry.
- [ ] Maintain a file-by-file route, page, component, database-call, provider, cron and integration inventory.
- [ ] Keep all modernization work on `refactor/factsport-v2`; no production DNS/routes/jobs/data changes during implementation.
- [ ] Establish deterministic installs (`npm ci`), lint, typecheck, unit, integration, Worker build and browser test gates.
- [ ] Add staging smoke coverage for cache isolation, auth boundaries, error paths, R2 access policies, Hyperdrive role identity and Cron execution.
- [ ] Preserve backups/restore paths for legacy Supabase, media and identity data; do not delete old data.

**Exit:** reproducible baseline and green CI with staging-only deploy boundaries.

### P1 — PostgreSQL schema, roles and durable job foundation

- [x] First clean-start migration created four base tables: `matches`, `app_users`, `external_identities`, `job_runs`.
- [x] Dedicated app reader Hyperdrive created and used by staging app.
- [x] Separate schedule writer and ESPN live-field writer provisioned.
- [ ] Review effective grants for every role, including PUBLIC privileges, role memberships/attributes, schema/database rights, function EXECUTE, sequence rights and column-level permissions. The current reader bootstrap verifies only selected negative privileges; strengthen this before treating it as production least privilege.
- [ ] Add migration ledger/checksum/ordering and forward-only versioned migrations; no ad-hoc schema mutation from app startup.
- [ ] Build remaining schema domains: teams, competitions/seasons, provider identity mappings, standings, match events/lineups/stats, predictions, eligibility, campaigns, VIP/entitlements, settlement ledger, editorial/CMS, media metadata, chat, MOTM votes, admin roles, audit events, notification/social outbox and session storage as required by selected auth provider.
- [ ] Add explicit FK/delete policies, check constraints, indexes, optimistic versioning, transaction boundaries and retention rules.
- [ ] Add transactional outbox and durable idempotency for scheduled jobs and external side effects.
- [ ] Create dedicated identities for app read, fixture ingestion, ESPN live updates, settlement, identity/account operations, CMS publishing and migrations. No one role receives all write access.
- [ ] Test DB backup/PITR and restore to a separate staging database; define RPO/RTO and connection/CPU limits for the selected B1ms tier.

**Exit:** schema is complete, every table/column/function has an owner and privilege contract, migrations replay cleanly, roles pass positive and negative integration tests, restore is proven.

### P2 — Sports data and match center

- [x] Schedule normalizer tests and controlled staging import for six competitions.
- [x] Staging schedule writer cannot delete matches or update score columns according to provisioning checks.
- [x] ESPN candidate generation and dry-run preview; 18 unique candidates were reported, none written.
- [ ] Review the 18 candidates against actual fixture identity and kickoff evidence; write only approved links with a reversible audit record and unique provider mapping.
- [x] Use the existing SELECT-only `factsport_v2_reader` runtime Hyperdrive for ESPN reconciliation/score previews; reserve the ESPN writer Hyperdrive for a future reviewed score updater.
- [ ] Build and deploy a separate ESPN score updater with exact match linkage, allowed live-field columns, event idempotency, source timestamps, concurrency/rate limits and no settlement access.
- [ ] Add a durable ESPN source-health state machine: separate upstream ESPN failure from Cloudflare Worker/Cron/network/DB/matcher/credential/quota failures; implement the owner-approved conditional FD fallback only after verified upstream degradation and with prompt ESPN recovery fencing.
- [ ] Preserve 3-second frontend live response semantics and short edge cache; avoid per-viewer database reads and full-league upstream request storms.
- [ ] Implement FT verification and correction/review rules before settlement; no ABD/cancelled/disputed match auto-settlement.
- [ ] Port ESPN-only cup coverage, matchmaker alias handling, team/season mapping, standings, logos, H2H, lineups, events, stats and highlights.
- [ ] Replace date-only pagination with stable compound cursor and deterministic ordering.
- [ ] Build sanitized provider fixtures for normal, delayed, missing, malformed, conflicting, duplicate, postponed, abandoned, extra-time, penalties and finished payloads.
- [ ] Compare complete staging match-center pages and provider output against the legacy behavior using representative fixtures.

**Exit:** sports data is current, traceable, anti-regressive and feature-complete; no settlement until verified FT and linked canonical identity.

### P3 — Public site, editorial and media

- [ ] Complete route/page/component parity across homepage, news, match center, leagues, standings, highlights, search, static/help pages, SEO and mobile.
- [ ] Build a real CMS with server-enforced editor/admin roles, drafts, review/publish workflow, revision history, provenance, attribution, source references and audit logs.
- [ ] Preserve human-authored editorial content and stable slugs only after private provenance and rights review. Legacy news has 366 rows: 167 known daily-briefing patterns, 120 known matchday-roundup patterns, 37 suspected additional roundup patterns, and 42 editorial candidates; none of the last 79 are proven manual solely by metadata.
- [ ] Mark generated/AI-assisted content explicitly; require human review and source validation before publication.
- [ ] Preserve both legacy `body` and `content` semantics during export; avoid loss of article content or slug/SEO metadata.
- [ ] Migrate approved media objects to private R2 with content type, size checks, signed/admin uploads, public delivery rules, metadata and rollback; verify image URLs, team crests, logos, social assets and highlights.
- [ ] Complete sitemap, canonical URLs, OpenGraph, structured data, robots/noindex for staging, accessibility, performance and AdSense policy readiness.

**Exit:** editorial team can create/review/publish/rollback content and public pages work with no legacy Supabase dependency.

### P4 — Identity, accounts, privacy and admin

- [ ] Select the production identity provider after staging proof: Entra External ID external tenant, shared Mkety Auth/OIDC, or app-owned Better Auth are documented candidates; do not use the workforce tenant as customer directory.
- [ ] Implement OIDC Authorization Code + PKCE, state/nonce, issuer/audience/signature/JWKS validation, callback allowlist, replay protection, secure session cookies, refresh/revocation and CSRF protections.
- [ ] Preserve immutable Factsport UUIDs and map `(issuer, subject)`; never auto-link old accounts by email alone.
- [ ] Decide which user accounts and profiles are retained, reset or reauthenticated; preserve paid VIP/financial/legal obligations explicitly.
- [ ] Implement server-side roles and entitlements independent of identity-provider claims; test user, editor, admin, support and worker authorization.
- [ ] Rebuild admin actions with per-action authentication, role checks, step-up/MFA, signed/session-bound vault unlock, rate limiting, audit trails and least-privilege DB roles.
- [ ] Add account export/deletion, consent, privacy, email verification/recovery, blocked users, duplicate identity and session invalidation workflows.
- [ ] Remove all runtime dependence on Supabase client/service role and all client-exposed cron/service credentials.

**Exit:** full signup/login/recovery/logout and role/entitlement lifecycle works in Cloudflare staging; admin bypass tests fail closed.

### P5 — Predictions, campaigns, VIP and settlement

- [ ] Recreate all rules and workflows from How-to-Play, not merely the old table shapes: daily first-five prediction limit, 3-point outcome, 10-point exact score, VIP eligibility, campaign bonus markets, monthly floor, league diversity, activity, draw mix and zero-score limits.
- [ ] Resolve legacy inconsistency: settlement awards 3 + 10 (13) for exact outcome+score, while audit code/function has used `points_awarded === 10`; first-five eligibility trigger exists in DB function inventory but was not attached to the expected table trigger.
- [ ] Define eligibility at prediction creation in one transaction with timezone, kickoff locking, unique user/match, campaign rules and concurrent submissions.
- [ ] Implement settlement in one database transaction: lock match, validate authoritative final state/version, calculate score ledger rows, enforce unique (match,user,settlement-version), update totals and mark match settled atomically.
- [ ] Support correction/reversal with immutable ledger adjustments; never silently overwrite settled history.
- [ ] Implement monthly rollover and winner audit with deterministic ranks, qualification-only prizes, ties, approval, evidence snapshots and replay protection.
- [ ] Add tests for fail/pass order, ties, fewer than prize slots, missing scores, duplicate runs, concurrent workers, retry after partial failure, month boundaries/timezones and VIP expiry.
- [ ] Keep the clean operational reset: new prediction/points/ranking history begins at zero; paid entitlements and outstanding legal/prize obligations are a separate preserve/reconcile decision.

**Exit:** full gameplay and reward rules pass DB integration and end-to-end replay/concurrency tests; no duplicate points or unqualified prize drafts.

### P6 — Community and live interaction

- [ ] Replace external D1 chat with same-origin authenticated API and PostgreSQL storage unless measured scale justifies a Cloudflare Durable Object.
- [ ] Derive user identity/name/avatar from server session, not client body; enforce message length, sanitization, moderation, spam/abuse limits, match eligibility and cursor pagination.
- [ ] Replace MOTM votes with server-validated candidates, one-vote/eligibility policy, atomic uniqueness and voting window enforcement.
- [ ] Decide whether any legacy chat/MOTM history must be retained; owner clean-reset direction does not automatically settle privacy/retention obligations.
- [ ] Preserve live polling UX and add load tests for concurrent viewers, chat, votes and cache-hit ratios.

**Exit:** no client-spoofed identity/votes, no public write bypass, rate limits and abuse controls verified.

### P7 — Integrations and automation

- [ ] Implement provider-neutral ports with working adapters and contract tests, not just TypeScript interfaces.
- [ ] Wire Mkety AI enterprise or Assist raw-model only after account/model entitlement, cost, idempotency and timeout semantics are verified; do not retry unknown commercial state with a new idempotency key.
- [ ] Wire Mkety Mail and verify sender domain, queue delivery, bounces/suppression and message status; HTTP 202 is queued, not delivered.
- [ ] Keep direct Facebook/Telegram integrations separate; route third-party Buffer/Make only through the chosen Logic Apps adapter.
- [ ] Create one authoritative job catalog and application JobRunner; deterministic run keys, durable locks, retries/backoff, dead-letter/manual replay, audit status and alerting.
- [ ] Preserve fixture ingestion, ESPN cup imports, matchmaker, live DB snapshot, FT verify, settlement, standings, monthly audit/reset, editorial AI, previews/roundups, social distribution, logo/highlight sync, indexing, unconfirmed-user cleanup and log/media retention.
- [ ] Fix job ordering: FT sync -> verify/finalize -> settlement -> standings/social outbox; await each critical dependency, never rely on a two-second sleep or concurrent independent requests.
- [ ] Verify every Cloudflare Cron invocation and Logic Apps test execution; ensure only one scheduler owns each production job.
- [ ] Rotate/remove old cron secrets and never use `?key=` URLs or client-exposed environment variables.

**Exit:** all jobs are observable/idempotent and only one production scheduler owns each; provider failures and retries are rehearsed.

### P8 — Security, reliability and performance

- [ ] Review Cloudflare Worker secrets, token scopes, routes, custom domains, access policies, R2 public access, Hyperdrive config, Cron schedules, logs and rollback versions.
- [ ] Treat the owner's 15 Cloudflare IP ranges as the accepted database ingress boundary (the owner confirms these are the only available ranges); perform a routine drift check that they remain in place and do not widen ingress. Verify TLS and all role grants from database metadata without retrieving secrets or private rows.
- [ ] Security test all public/private routes, admin actions, webhook endpoints, CSRF, rate limits, request sizes, upload content types, SQL parameterization and cache isolation.
- [ ] Run dependency/license audit, secret scan, SAST, lint, typecheck, unit/integration/e2e and Workers compatibility/build checks.
- [ ] Load-test Cloudflare Worker CPU/memory, Hyperdrive pool, Azure B1ms CPU credits, P95/P99 latency, R2, ESPN quota, 3-second cache hit ratio and burst fan-out.
- [ ] Configure privacy-safe structured logs, request IDs, provider/job health dashboards, alerts, backup/restore, incident contacts and retention.
- [ ] Verify no stale staging credentials/tokens/temporary Workers remain; define rotation/expiry and cleanup for persistent staging resources.

**Exit:** security review passed, performance within measured capacity, alerts and restore/rollback rehearsed.

### P9 — Production rehearsal and controlled cutover

- [ ] Create a complete legacy-to-v2 route/table/feature/provider/job mapping and sign off every row.
- [ ] Take immutable, protected legacy DB/storage backups; validate restore; keep legacy production running and unchanged during rehearsal.
- [ ] Populate v2 from clean-start rules: fresh operational sports data, reviewed authored editorial assets, approved identities/entitlements only; no old gameplay history.
- [ ] Run shadow reads and compare match/standings/news/public page behavior; compare auth, VIP and prediction entitlement outcomes without dual-writing business transactions.
- [ ] Run at least one complete real match lifecycle in staging: fixture import -> ESPN link -> 3s live feed -> FT verification -> settlement -> leaderboard -> social outbox -> final match page. Repeat/replay each job to prove idempotency.
- [ ] Run complete signup/login/admin/CMS/VIP/chat/MOTM/notification journeys with test identities and payment sandbox or manual test evidence.
- [ ] Rehearse cutover freeze, last sync, DNS/route change, cache purge, Worker version rollback, database rollback/reconciliation, legacy job stop/start and incident response.
- [ ] Confirm Cloudflare production Worker bindings/secrets/routes/domains and monitoring. Never point production domain at staging.
- [ ] Obtain explicit written production go/no-go from owner. Only then deploy production and switch routes/DNS.
- [ ] Observe canary traffic, errors, live match accuracy, settlement correctness, auth failures, P95 latency, DB load and R2 errors; define rollback thresholds and time window.
- [ ] Retire legacy GitHub Actions, cron-job.org, external Workers, Supabase service keys and Supabase project only after stable production parity and retained backups/obligations are signed off.

**Exit:** explicit owner go/no-go; documented rollback; one authoritative production app, DB, scheduler and provider topology.

## 4. Current blockers and owner decisions

1. **Identity provider:** Entra External ID, shared Mkety Auth/OIDC or Better Auth still needs a final choice after real staging PoC. External tenant was not created in the evidence reviewed.
2. **Editorial retention:** preserve manually authored and rights-cleared content; 79 articles require provenance review; don't infer human authorship from the default author field.
3. **Accounts and money:** define treatment of old user identities, paid VIP entitlements, pending subscriptions, prize obligations and compliance records before any reset/migration.
4. **ESPN links:** approve the 18 candidate links before writing mappings.
5. **Conditional FD live fallback:** owner approved the principle, but thresholds/poll cadence/observation timestamp requirements still need real telemetry and tuning.
6. **Azure/Logic Apps:** actual region/price/budget and Logic Apps execution cost must be verified in the owner's subscription. The DB planning target is not a billing quote.
7. **Legacy external Workers:** exact current deployed versions, custom routes, D1 schemas and cron-job.org schedules must be inventoried from owner account before retirement.
8. **Production DNS and Cloudflare routes:** not changed or audited live in this source pass.

## 5. Non-negotiable cutover rules

- No production deployment, DNS switch, production data write, Supabase permission change, Azure Logic App enablement, legacy cron disablement, or production secret rotation is implied by this plan.
- No app Worker uses the admin Hyperdrive. Runtime and job identities remain separate.
- No new product capability is declared complete because a health endpoint returns 200.
- A feature is complete only when its data model, authorization, user journey, error/retry behavior, observability, tests, and rollback are all complete.
- Preserve old production and backups until the new system has passed the full match lifecycle, account lifecycle, paid entitlement and editorial acceptance gates.


### Latest staging infrastructure verification

Cloudflare staging workflow [42261414894](https://github.com/MketyDigital/Factsport/actions/runs/42261414894) verified the runtime Hyperdrive's exact Factsport database identity, disabled query caching, five-connection origin limit, and successful DB probe. The same workflow checked Cloudflare R2 managed `r2.dev` access is disabled and no custom domain is enabled, then passed private R2 binding smoke. The follow-up config now also requires TLS mode `require`; its rerun is pending at the time of this update.


The stricter TLS-required Hyperdrive gate passed in run [42261593655](https://github.com/MketyDigital/Factsport/actions/runs/42261593655), including the private R2 and database smoke checks. This supersedes the earlier note that the TLS guard rerun was pending.


## Route-by-route implementation register

Use [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md) as the route-level register for every legacy API, its current Supabase/provider dependencies, target v2 service and acceptance requirements. Keep that matrix updated as each route is ported and tested.
