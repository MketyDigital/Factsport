Warning: truncated output (original token count: 19495)
Total output lines: 555

# Factsport v2 — production execution plan and cutover gates

**Branch:** `refactor/factsport-v2`  
**Plan owner:** Factsport maintainer  
**Updated:** 2026-11-21  
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
| Identity | Factsport-owned immutable user IDs, roles and entitlements; Microsoft Entra External ID in a dedicated customer external tenant for customer sign-in, with OIDC behind an adapter. Media editor identity remains isolated. Customer external tenant `factsports.onmicrosoft.com` is now confirmed in subscription inventory; app registrations, secrets and runtime acceptance remain unverified. Do not use workforce Entra for customers or assume sign-in is live |
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

- [ ] Apply and verify editorial/homepage/competition migrations 0004-0007 on isolated staging only; add ordered migration ledger/checksums before production use.
- [ ] Complete homepage PostgreSQL parity: migrate public affiliate/config settings and the Bet of the Day `pro_analysis` projection without exposing private analysis; verify all nested component and 3-second live paths.
- [ ] Verify the new `/highlights` and `/standings` PostgreSQL routes, build provider ingestion for standings/player stats/highlights, complete editorial CMS commands, media upload/rights-review workflow and admin RBAC.

- [ ] Complete route/page/component parity across homepage, news, match center, leagues, standings, highlights, search, static/help pages, SEO and mobile.
- [ ] Build a real CMS with server-enforced editor/admin roles, drafts, review/publish workflow, revision history, provenance, attribution, source references and audit logs.
- [ ] Preserve human-authored editorial content and stable slugs only after private provenance and rights review. Legacy news has 366 rows: 167 known daily-briefing patterns, 120 known matchday-roundup patterns, 37 suspected additional roundup patterns, and 42 editorial candidates; none of the last 79 are proven manual solely by metadata.
- [ ] Mark generated/AI-assisted content explicitly; require human review and source validation before publication.
- [ ] Preserve both legacy `body` and `content` semantics during export; avoid loss of article content or slug/SEO metadata.
- [ ] Migrate approved media objects to private R2 with content type, size checks, signed/admin uploads, public delivery rules, metadata and rollback; verify image URLs, team crests, logos, social assets and highlights.
- [ ] Complete sitemap, canonical URLs, OpenGraph, structured data, robots/noindex for staging, accessibility, performance and AdSense policy readiness.

**Exit:** editorial team can create/review/publish/rollback content and public pages work with no legacy Supabase dependency.

### P4 — Identity, accounts, privacy and admin

- [x] Select Entra External ID in a dedicated customer external tenant for customer sign-in; the tenant resource now exists. [ ] Provision/verify the customer app registration, login flow, callback/session configuration and run the full staging sign-in/recovery proof. Never use the workforce tenant as the customer directory.
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

**Exit:** all jobs are observable/idempotent and only one production scheduler owns each; provi…9495 tokens truncated…ned-gate sequence only for release order; the scoped Media/TV switch still requires route proof, staging acceptance, backup/restore, rollback and a written owner go/no-go. No Predict cutover or legacy retirement is implied. See ROADMAP M78/M94.


### M79 Azure inventory reconciliation — 2026-11-16

Read-only Cloud Shell inventory confirms customer External ID tenant `factsports.onmicrosoft.com`; app registrations and OIDC journeys remain unverified. It confirms PostgreSQL Flexible Server `mketypostgres` (`mkety_group`, West US, Ready, PG18, B1ms, 32 GiB, 7-day backups) and database `factsport_v2`. Do not run the legacy PG16 bootstrap with `APPLY=1`; its duplicate-database guard now fails closed. The Logic App `la-factsport-v2-staging` is Disabled with a five-minute recurrence and only `NonMutatingDesignOnly`; the staging resource group has no API connections and no subscription budgets were listed. Firewall/TLS, migration versions, grants, Hyperdrive target, restore proof and Entra app configuration remain open. No cloud resources were changed. See ROADMAP M79.

### M79 PostgreSQL network follow-up — public endpoint allowlist

Azure Cloud Shell reports `publicNetworkAccess=Enabled`, no subnet ID, and 15 IPv4 firewall rules on `mketypostgres`. The endpoint is public with IP allowlisting. The screenshot shows `factsport-cf-04` spans 104.16.0.0–104.31.255.255, broader than Cloudflare's published 104.16.0.0/13 and 104.24.0.0/14 blocks. Treat as firewall drift; verify the real Hyperdrive source path before any scoped correction. Do not edit firewall rules from screenshot evidence alone. Database detail query failed due CLI argument parsing; DB metadata, TLS, roles, migrations, Hyperdrive target and restore proof remain open. No Azure network changes were made.

### M79 Entra staging configuration boundary

Source review of `lib/auth/entra-external.ts` and `app/api/auth/entra/*` shows an implemented, host-restricted OIDC/PKCE sign-in path for the **Media editor/admin surface**. It requires `ENTRA_EXTERNAL_DISCOVERY_URL`, `ENTRA_EXTERNAL_ISSUER`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_REDIRECT_URI`, and `FACTSPORT_AUTH_SESSION_SECRET` (base64url-encoded 32-byte key). The current code does not read or use `ENTRA_EXTERNAL_CLIENT_SECRET`; do not add one without a deliberate confidential-client code change. Callback sign-in only succeeds for an issuer/subject already linked in `public.external_identities`; it is not self-service account creation.

This is **not yet customer Entra sign-up/login or Prediction account auth**. Public customer identity, account linking/claim, recovery, registration, entitlements, and Prediction host flows remain unfinished. The staging deployment now accepts all five values as GitHub Actions secrets, validates them as an all-or-none set (HTTPS endpoints, exact callback path, canonical 32-byte session key), and includes them only in the staging Worker's secrets file. If none are set, Entra stays disabled. This is configuration plumbing only; sign-in still needs a real External ID user flow, a linked editorial identity, and staging end-to-end acceptance. The existing `DATABASE_URL` is a privileged PostgreSQL setup/migration credential and is unrelated to Entra registration. Keep it inside a reviewed, sanitized workflow; never paste or log its value. The app uses Cloudflare Hyperdrive for runtime DB access.


### 2026-11-18 owner clarification — clean V2 target

The clean-reset decision means no legacy operational database restore/import: the existing `factsport_v2` database is the V2 target, its operational gameplay data starts fresh, and newly ingested V2 fixtures are preserved. The P1 backup/PITR requirement is a recovery-resilience check of this V2 target before production release; it is not a legacy data source and does not block implementation of the reviewed forward migration chain. Keep production routes and data untouched.

### 2026-11-18 — fresh V2 schema chain applied

The guarded staging migration workflow [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) completed successfully against the verified Azure PostgreSQL target `factsport_v2`, connecting as the administrative migration identity `mketydbadmin` through the exact V2 Hyperdrive. It applied all 49 ordered migrations, versions 0000–0048, and verified a contiguous SHA-256 migration ledger. No legacy operational data was restored or imported; the V2 clean-start target and existing V2 fixtures remain the intended source of truth.

This closes the applied-schema step for the V2 migration chain. It does not prove all Media/runtime roles and credentials are provisioned, create runtime Hyperdrive bindings/logins, complete the real Entra editor journey, complete Media/provider acceptance, enable the disabled Azure Logic App, or establish backup/PITR recovery. Production remains no-go. Continue with a separate read-only schema/role/ledger audit, then finish Media runtime provisioning and acceptance, recovery rehearsal, route isolation and P9A rollback/go-no-go before any Media cutover. Prediction remains P9B; Factsport TV remains P10 after Media and Prediction are stable.


### 2026-11-18 — V2 migration and catalog verification

The migration step against the existing V2 target is complete: [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) applied 49 migrations (0000–0048), then read-only audit [44360257808](https://github.com/MketyDigital/Factsport/actions/runs/44360257808) verified the complete checksum ledger, 80 public relations and all 11 NOLOGIN capability roles. The audit found no role memberships, no schema object creation/temp rights, and the scoped community and Prediction function grants. No legacy restore/import and no production changes.

The remaining P1 work is to prove V2-target backup/PITR recovery, not to restore the legacy database. Media still needs its dedicated LOGIN roles/Hyperdrive bindings, real linked Entra editor journey, provider delivery reconciliation, selected Logic Apps adapter/identity/cost/monitoring and full acceptance. Do not begin P9A cutover until route inventory and rollback rehearsal pass; Prediction remains P9B and TV P10.


### 2026-11-18 follow-up — editorial runtime binding is live in staging

Staging bootstrap [44362059881](https://github.com/MketyDigital/Factsport/actions/runs/44362059881) provisioned the dedicated editorial application LOGIN and TLS-required/cache-disabled Hyperdrive, and staging app run [44362390781](https://github.com/MketyDigital/Factsport/actions/runs/44362390781) passed on commit `3b1ef8fe79bbd39baea790bf747d81def0bda6f8`. Generated credentials remain out of source and CI logs. This closes the first editorial DB runtime identity/binding step; real Entra identity linking and editor flow, other required Media adapters, Logic Apps validation (workflow stays disabled), V2 backup/PITR recovery, public/editorial acceptance, route isolation, rollback and P9A remain open. No legacy database restore/import is part of V2; the recovery gate is for `factsport_v2`.


### 2026-11-21 M82 — Entra callback acceptance follow-up

The exact Media Entra callback route now bypasses the legacy middleware threat-pattern heuristic so opaque OAuth query values can reach the existing OIDC validator. The validator still fails closed on missing/invalid state and enforces PKCE, issuer, audience, signature, nonce and an exact linked editorial identity. The staging workflow now checks the no-state failure redirect. Source/handoff: [M82](./handoffs/M82-ENTRA-CALLBACK-THREAT-BOUNDARY.md); roadmap record: [M82](./ROADMAP.md#m82--entra-callback-filter-and-release-reposition-2026-11-21).

This is a staging verification hook, not completion of P4 identity acceptance. Confirm a run on the exact changed head, then complete real browser sign-in, issuer/subject membership, negative RBAC, publish/unpublish/logout and redacted operational evidence. P9A remains blocked on the full Media, sports, recovery, route-isolation, rollback and owner go/no-go gates; P9B and P10 remain separately ordered. No production changes.


### 2026-11-21 M83 — match share-card implementation follow-up

The M74-D source now has text-only finished-result and complete-starting-XI Open Graph templates, conditionally wired from canonical match metadata. Public match title metadata no longer includes Prediction wording. The staging workflow checks PNG signatures and exact 1200×630 dimensions for article, result and lineup cards. Record: [M83](./handoffs/M83-MATCH-SHARE-CARDS.md), [ROADMAP M83](./ROADMAP.md#m83--match-result-and-lineup-share-cards-2026-11-21).

This remains source implementation until exact-head build/staging and visual/crawler/mobile/accessibility/rights acceptance pass. It does not close P3, P8, P9A or establish public/private route isolation. No production change.

### 2026-11-21 M84 — Public Media and Prediction boundary

Removed Prediction/bookmaker actions from public match cards, match detail and the match-center tab, renamed the homepage `/matches` shortcut, and stripped model probabilities from public match serialization/live API responses. Prediction source and backend contracts remain available for the later private P9B product. A staging assertion now checks rendered `/matches` and a real `/match/{id}` route, and an enabled public live API response must omit the `predictor` field. See [M84](./handoffs/M84-PUBLIC-MEDIA-PREDICTION-ISOLATION.md) and [ROADMAP M84](./ROADMAP.md#m84--public-mediaprediction-surface-isolation-2026-11-21).

This is implementation only until exact-head build/staging and full public-route/metadata/feed/manifest review pass. It does not close P9A or authorize a route switch. No production changes.

### 2026-11-21 M86 — newsroom boundary and M85 regression follow-up

The public newsroom shortcut now says “Matches” for its existing `/matches` destination; decorative newsroom artwork no longer fetches a third-party texture. The match Open Graph fallback retains validated live/finished scores. Regression assertions now reflect the M84 public Media boundary and the exact Entra callback threat-filter exception. See [M84 follow-up](./handoffs/M84-PUBLIC-MEDIA-PREDICTION-ISOLATION.md) and [ROADMAP M86](./ROADMAP.md).

- The earlier Cloudflare staging smoke at `ae9f6fd` returned 404 because match detail was disabled; staging-only commit `66ca911` enabled its verified PostgreSQL read gate. Runs [#1297](https://github.com/MketyDigital/Factsport/actions/runs/45040575831) and [#1300](https://github.com/MketyDigital/Factsport/actions/runs/45040955506) then isolated the remaining HTTP 500 to the team-form read, while confirming the reader's migrations and grants were already correct. No grant migration was needed. M88 in the roadmap records the repair and exact-head acceptance.



### 2026-11-22 M88 — Cloudflare staging match-detail runtime accepted

Exact V2 head `418edd7400e053e27b6bcb02000b1e5fe695f5b` passed isolated verification [45044116175](https://github.com/MketyDigital/Factsport/actions/runs/45044116175), native Cloudflare build [45044116156](https://github.com/MketyDigital/Factsport/actions/runs/45044116156) and protected staging [45044117315](https://github.com/MketyDigital/Factsport/actions/runs/45044117315). Match-form reads now use the canonical stored team names with a two-year date bound; successful query results are not discarded by a client-shutdown error. The public match detail API strips predictor data.

Staging verified the read-only match-detail runtime probe, PostgreSQL-backed `/matches` and real `/match/{id}` pages, public Media/Prediction isolation, pagination and access isolation, article/result/lineup 1200×630 PNG share cards, and Entra configuration/PKCE plus fail-closed callback boundaries. This does not complete the real editor identity-link/membership and publish/unpublish/logout journey, all Media routes/providers/lifecycle/browser/accessibility/rights checks, V2 backup/PITR restore and rollback rehearsal, or P9A owner approval. Production routes and DNS remain unchanged; do not cut over until those remaining gates pass.


### 2026-11-22 M89 — staging homepage/news routes enabled

Migrations 0006, 0007 and 0024/0025 were reviewed for least-privilege public read views. The V2 Cloudflare staging Worker now enables PostgreSQL editorial and homepage read gates with the existing dedicated editorial and reader Hyperdrive bindings. The one-click workflow checks protected `/` and `/news` rendering in addition to the established match/detail/share-card/Entra boundary checks.

Exact-head isolated verification [45045456878](https://github.com/MketyDigital/Factsport/actions/runs/45045456878) and staging build/deploy [45045456852](https://github.com/MketyDigital/Factsport/actions/runs/45045456852) passed on `2c79d0fec4072c57654be8d8b4aebb16fa5e7e6c`. This validates the server render paths, not that new editorial/highlight/featured data has been ingested or that visual, mobile, accessibility, crawler, rights, provider and editor-authorization acceptance is complete. Competition standings remain disabled pending data verification. No production routes or DNS, legacy system, or Logic App changed.


## 2026-11-23 progress addendum — M91

The V2 branch now has deterministic npm installs (`package-lock.json`, 16 V2 workflows using `npm ci`). Local tests, TypeScript, and Vinext build passed; exact-commit staging app/build/migration/import/R2/ESPN-preview checks passed. Staging role hardening and a post-hardening read-only catalog audit passed on the current V2 head. The audit now verifies the full 51-entry, checksummed migration ledger (versions 0–50) and fails closed if incomplete. Evidence and exact links are in [M91](./handoffs/M91-DETERMINISTIC-CI-STAGING-LEDGER.md).

The owner has already completed Entra sign-up and sees the account in both Microsoft directories. The remaining acceptance is a successful round trip through Factsport's callback/session, exact issuer+subject mapping, active publisher role, and real CMS draft/review/publish/unpublish/logout. M82 recorded a callback blocked by middleware; later synthetic staging coverage is not a substitute for that real account test. Do not request another registration.

This does not close P9A. Complete public Media parity and visual/accessibility/rights/SEO/CWV review, provider-fed lifecycle/standings, V2 backup/PITR/restore, route/DNS rollback rehearsal, load/security, and owner legal/AdSense decisions remain open. Keep production cutover blocked until all P9A evidence is complete and the written Media-only go/no-go is recorded. Prediction P9B and TV P10 remain separate.


### 2026-11-23 — M93 owner direction update

Free anonymous Predictions remain a required feature on `predict.factsport.com`; AUTH-005 is active. Public Media (`factsport.com`) remains prediction-free, including its page UI and submission API. Factsport TV is a concurrent required V2 workstream alongside Media and Predict. The production release plan has been updated so P9A is readiness/staging only; no route or DNS cutover occurs until Media, Predict and TV acceptance, combined rollback, and final owner go/no-go are all complete. See [ROADMAP M93](./ROADMAP.md) and [TV-001](../implementation/TV-001-factsport-tv-engine.md).


### M93 implementation update — 2026-11-23

The Predict landing now exposes free fixtures without registration and the match-detail submit UI is guarded by the exact configured subdomain and submission-ready flag; match-list advertisements are suppressed on the Predict host. The submission API uses the same host boundary. TV has an offline planner, reviewable social package, server-only YouTube resumable-upload primitives, and a read-only `/admin/tv` storyboard prototype. Rendering, storage/outbox, OAuth connection, rights and end-to-end acceptance remain open. No production posting has occurred.


### 2026-11-24 — M100 TV editorial planning accepted in staging

Exact source head `aa0a5e9` passed isolated verification [45324494210](https://github.com/MketyDigital/Factsport/actions/runs/45324494210), the native Cloudflare build [45324494239](https://github.com/MketyDigital/Factsport/actions/runs/45324494239), and protected staging preflight [45324494220](https://github.com/MketyDigital/Factsport/actions/runs/45324494220). TV now supports persisted episode drafts, evidence-linked narration, independent script review and a stored text-only storyboard. Staging verification confirms deployment and deny-by-default boundary only; it does not verify the authenticated TV editor journey or real content review. Rights evidence, production-quality render/audio/caption QA, private asset storage, OAuth and human-reviewed social delivery remain required before TV launch. The current free Prediction subdomain and production routing are unchanged.


### 2026-11-24 — M101 private storyboard visual acceptance

Exact source head `454c932` passed isolated verification [45342942972](https://github.com/MketyDigital/Factsport/actions/runs/45342942972), native Cloudflare build [45342942964](https://github.com/MketyDigital/Factsport/actions/runs/45342942964), and protected staging deploy plus deny-by-default check [45342943031](https://github.com/MketyDigital/Factsport/actions/runs/45342943031). The new visual layer is a private concept preview only. It does not satisfy video rendering, asset-rights, audio/captions, output QA, OAuth, social dispatch or authenticated owner-editor acceptance. No production cutover or social post occurred; the existing free Prediction domain remains unchanged.


### 2026-11-24 — M102 TV evidence display

Exact source head `3f0d6c6` passed isolated verification [45343476559](https://github.com/MketyDigital/Factsport/actions/runs/45343476559), native Cloudflare build [45343476547](https://github.com/MketyDigital/Factsport/actions/runs/45343476547), and protected staging [45343476525](https://github.com/MketyDigital/Factsport/actions/runs/45343476525). The Studio preview shows fact sources and observation timestamps alongside narration. This improves human review only; source/asset rights, render/audio/caption QA, OAuth, social publishing acceptance, and real editor browser verification remain open. No production routing or social content changed.


### 2026-11-24 — M103 private TV model intake

Migration 0053 established the TV model library and episode links; guarded staging migration [45353663369](https://github.com/MketyDigital/Factsport/actions/runs/45353663369) verified the isolated `factsport_v2` database and 54 checksummed migrations (0–53). Disposable PostgreSQL migration verification [45353666408](https://github.com/MketyDigital/Factsport/actions/runs/45353666408) passed. Code head `cb2d13a` passed isolated verification [45354250796](https://github.com/MketyDigital/Factsport/actions/runs/45354250796), native Cloudflare build [45354250921](https://github.com/MketyDigital/Factsport/actions/runs/45354250921), and staging [45354251013](https://github.com/MketyDigital/Factsport/actions/runs/45354251013). The private `.glb` intake stores user-submitted provenance as pending; no model has been rights-approved or used to render. The owner has not attached the stadium file or identified its source page. No production routes, credentials, public uploads or social posts changed.

### 2026-11-24 — M104 TV asset rights-review workflow

Added a media-admin-only rights decision path for private model assets. It records the reviewer, timestamp, evidence links and rationale in provenance and the TV audit log. Clearing is blocked without a license name, HTTPS evidence URL and meaningful note; the uploader cannot clear their own asset, and revoked versions cannot be restored. This code path does not verify the truth of an external license page, render the model, or authorize publication. Exact-head CI/staging evidence remains pending.
