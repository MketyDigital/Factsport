# Factsport modernization — master roadmap
Status: M0 baseline still in progress; M6 Cloudflare staging and M7 PostgreSQL foundation partially verified; production remains paused | Repository: MketyDigital/Factsport | Branch: refactor/factsport-v2
Updated: 2026-10-30

## Governing decisions
- Preserve original repository and commit history throughout the modernization; repository remains PUBLIC until release and production reactivation. Do not put confidential audit outputs, user data, credentials or Supabase exports in this repo.
- Production is paused. Never deploy or trigger production-writing workflows without approval.
- Football media, live scores, news, fixtures, highlights and match center FIRST; prediction games and VIP SECOND.
- Use **vinext** as the target Cloudflare Workers deployment toolchain. Do not use OpenNext. Run `vinext check` on an upgraded compatible project, then `vinext init` in the isolated branch only after dependency checks; preserve Next.js as verification baseline until parity tests pass.
- Preserve both ESPN and football-data.org pathways, matching/arbitration behavior, match updates, editorial tools, games, prediction settlement and all other existing behaviors unless a change is explicitly approved.
- Replace Supabase methodically with Mkety Core PostgreSQL (authoritative) and Cloudflare supporting services; only use D1 where measured useful. Authentication migration requires its own tested plan.
- GitHub Actions hosted runner allowance and shared Mkety development runners are separate concerns; production is on Cloudflare.
- AdSense readiness means genuine policy-compliant content, navigation and monetization, not disguising prize or wagering mechanics.


## Clean-data reset decision (2026-10-30)
- **Fresh operational data, full system retained:** do not import old matches/events/scores, predictions, rankings, accumulated points, generated stats or operational logs. Recreate their database structures and re-enable all the systems that generate them so new data starts from zero.
- Recreate schema, constraints, functions, triggers, permissions, engines, providers, cron jobs, news tooling and integrations. Bootstrap new fixtures from ESPN/football-data.org safely; no mass social blast.
- Independently decide retention/migration of accounts, paid VIP entitlements, authored news/media and legal obligations; do not accidentally delete or invalidate them. Never delete old Supabase data during audit.
- See `docs/audit/DB-002-clean-reset-policy.md` for class-by-class rules, risks and acceptance gate.

## Evidence labels
- VERIFIED SOURCE: read implementation and record file paths, function names and behavioral evidence.
- INVENTORIED: path exists but implementation not fully reviewed.
- DB VERIFIED: confirmed by Supabase SQL metadata, redacted.
- RUNTIME VERIFIED: reproduced in tests or local preview.
- OPEN: not yet inspected or resolved.

## Milestones and gates
### M0 — baseline, scope, protections
- [x] Create `refactor/factsport-v2` from current main.
- [x] Enumerate tracked tree; initial inventory 162 files; 28 page.tsx, 26 route.ts(x), 5 scripts, 4 workflows (snapshot 2026-10-30).
- [ ] Record immutable baseline commit and verify branch HEAD; configure main protections with maintainer consent.
- [ ] Inventory complete feature surface and dependencies, file by file.
- [ ] Review current schedules: avoid costly/writing jobs running on untrusted code branches.
Gate: feature baseline accepted; no production writes.

### M1 — page / UI / content mapping
- [ ] Inspect 28 page routes, layout/providers, components, navigation, homepage, footer, news, highlights, match center and mobile UI.
- [ ] Record primary user journeys, empty/error/loading states, accessibility/SEO and AdSense eligibility.
Gate: full route-to-feature matrix, editorial-first information architecture.

### M2 — APIs / sports engines / schedules
- [ ] Inspect all 26 API routes, middleware, five scripts and four workflows.
- [ ] Trace football-data.org sync, ESPN fetch/live, ID matchmaker, dual-source arbitration, event/status reconciliation, deduplication, standings, logos and highlights.
- [ ] Trace AI/social/editorial automation and all external dependencies.
- [ ] Document rate limits, failure modes, ownership, retry and fallback, credential scope.
Gate: sequence diagrams, API/cron dependency map and provider fixture corpus.

### M3 — Supabase database and auth inventory
- [ ] Obtain read-only SQL metadata: public tables/columns, constraints/indexes, RLS/policies, public functions, triggers, cron jobs, extension names, approximate counts, storage bucket metadata and auth configuration indicators; never copy private user rows or secrets into PUBLIC repo.
- [ ] Trace each code DB call to table/function and which role can execute it.
- [ ] Plan schema migration, identity/session migration, dual reads or cutover, data verification, rollback.
Gate: signed-off data contract and zero-loss migration approach.

### M4 — executable regression baseline
- [ ] Unit tests: provider normalization, alias resolution, match statuses, timezones, provider disagreements, dedupe.
- [ ] Integration tests: fixtures/results, leaderboards, prediction limit, 3/10-point rules, VIP checklist, campaign bonus, settlement idempotency and monthly resets.
- [ ] E2E: public editorial flows, admin security, logged-in user journeys.
Gate: old baseline behavior reproducible.

### M5 — framework/toolchain modernization
- [ ] Upgrade Next.js/React/TS/Tailwind/lint/test dependencies in small groups; remove deprecated scripts.
- [ ] Run typecheck, build, tests and browser parity after each batch.
- [ ] Capture framework/runtime compatibility exceptions.
Gate: Next.js baseline checks passing.

### M6 — vinext and Cloudflare
- [ ] Run official vinext compatibility check, resolve findings.
- [ ] Run vinext alongside Next.js temporarily; compare routes, RSC, server actions, middleware, cache, image, fonts and cron behavior.
- [ ] Configure Cloudflare Workers, secrets, binding types, preview environments, observability, queue/cron and rollbacks.
Gate: Cloudflare staging parity and performance verified.

### M7 — database/auth/storage migration
- [ ] Migrate to Mkety Core PostgreSQL with isolated Factsport roles/schema, pooled connectivity/Hyperdrive tests.
- [ ] Decide on D1/KV/R2/Durable Objects only for justified use cases.
- [ ] Migrate auth, assets, SQL functions and triggers, RLS replacement, event jobs and audit logs.
- [ ] Validate counts, checksums, access controls, staged cutover and rollback.
Gate: no data loss, auth and settlement parity.

### M8 — media-first redesign
- [ ] Editorial landing page, live coverage, league/team/match pages, original content workflows, search, schema metadata, sitemap and performance.
- [ ] Ensure news/match data provenance, content licensing and affiliate/ad disclosures.
Gate: UX and editorial review.

### M9 — games, community, VIP enhancement
- [ ] Preserve existing prediction engines and documented How-to-Play requirements.
- [ ] Expose transparent rule progress; qualify rewards correctly; protect admin operations.
Gate: score reconciliation and eligibility tests passing.

### M10 — AdSense/compliance/security/performance
- [ ] Audit publisher restrictions against actual VIP/prize mechanics (not text-only concealment).
- [ ] Audit rate limiting, bot protection, authz, secrets, provenance, accessibility, Core Web Vitals, CDN cache and DB loads.
Gate: policy/legal reviews where required and security/quality thresholds met.

### M11 — staging, rollout and final Git-history decision
- [ ] Check release smoke, disaster recovery, backups, cutover, monitoring and incident runbooks.
- [ ] Production approval, then staged rollout on Cloudflare.
- [ ] Only AFTER success decide whether history reset/new private source snapshot is warranted. No history rewrite while work is in flight.
Gate: explicit production go/no-go.

## Every milestone must leave an agent handoff
Write `docs/audit/handoffs/MXX.md` with:
1. Scope and objective
2. Baseline commit and working branch/head
3. Source files inspected and evidence (exact path/function/line where possible)
4. What was changed (commit/PR) and what was NOT changed
5. Features/behaviors preserved, tests run, commands/results
6. DB schema objects and migrations involved (metadata only)
7. Risks/blockers/security notes, unresolved questions
8. Rollback steps, staging verification
9. Next agent's exact first actions and acceptance criteria
10. Status: INVENTORIED / VERIFIED SOURCE / DB VERIFIED / RUNTIME VERIFIED

## Early source-backed findings (2026-10-30)
- `package.json`: Next.js 14.2.35, React 18.3.1, Supabase client/SSR, and `@cloudflare/next-on-pages` deployed as legacy Pages approach.
- `app/lib/matchService.ts`: football-data.org v4 ingestion, league map and status conversion; `getExternalData` supplements match data from ESPN.
- `app/lib/espn.ts`: ESPN scoreboard and event summary helpers.
- `app/api/sync-fd/route.ts`: football-data.org fixture synchronization and ESPN fallback for league standings; updates Supabase `matches` and `standings`.
- `app/api/matchmaker/route.ts`: canonical name aliases, fuzzy ESPN-to-DB matching, ESPN ID assignment; safeguard against duplicate assignment in same run.
- `app/api/live/route.ts`: ESPN live update route; uses module-local `Map` called `kvCache` (NOT persistent Cloudflare KV). Must evaluate correctness across Worker isolates, concurrency and retries.
- `app/api/settle/route.ts`: calls Postgres RPC `settle_match_points`, then marks `matches.points_distributed`; inspect RPC for atomicity and idempotency before altering.
- `app/page.tsx`: existing editorial homepage blends news, highlights, fixtures, leaderboard/competition entry points and legacy ad integration.
- `app/how-to-play/page.tsx`: daily first-five limit, outcome=3, exact score=10, monthly VIP qualification, campaign rules; requires comparison with actual SQL settlement engine.
- `.github/workflows/allInOne.yml`: GitHub scheduled generation for AI pro slips, morning preview, matchday roundups; review runtime/credentials and potential duplicated schedule at 08:00 UTC.
These are verified file reads but NOT yet a complete file-by-file code audit.

## Provider precedence — user-confirmed on 2026-10-30
- **ESPN is authoritative for LIVE scores, match status/clock and rich events when successfully matched.**
- **football-data.org is used when ESPN matchmaker cannot match/synchronize the fixture, and to verify final-time (FT) scores.** Preserve existing scheduled fixture/bootstrap and standings workflows; they must not override ESPN's in-progress coverage.
- Do not reinterpret multi-provider support as equal-priority parallel live providers, or claim present ID collisions without evidence.
- M1/M2 acceptance: source provenance, stable internal `matches.id`, ESPN ID linkage/matchmaker, unmatched fallback, final-score reconciliation, ESPN cup import, retries, conflicts, anti-regression, and DB tests. See `docs/audit/SPORTS-001-fixtures-standings-schedules.md`.

## Provider ingestion/live separation — user clarification 2026-10-30
- Main **fixture and competition ingestion**: football-data.org for everything in its accessible free tier; ESPN fills unsupported league/tournament/fixture coverage. Keep both operational sync jobs.
- ESPN is the preferred **fast LIVE** provider when matchmaker successfully links a fixture (regardless of fixture origin), and powers ESPN-added cup coverage.
- football-data.org's typically 5–15-minute-lag live data remains available for matches without a working ESPN mapping; it also checks/reconciles FT scores. This lag is user-reported, not measured by this audit.
- Never overwrite ESPN-linked live status with slower FD live updates under current code; owner must decide temporary ESPN outage behavior before changing.
- Regression gates must include FD-origin fixture + ESPN enrich, FD-only unmatched slower live, ESPN-only competition import, FT checking, missing/late result, repeat event and provider provenance.

## Conditional LIVE failover decision — user-approved (2026-10-30)
- For ESPN-matched fixtures, enable FD delayed LIVE fallback **only after a verifiable ESPN upstream degradation**; never treat a stalled score, missing worker poll, Cloudflare/network/DB fault, matcher failure, or our own throttling as an ESPN outage.
- Preserve ESPN as preferred fast live feed and reestablish it on validated recovery; FD must not supersede fresher ESPN updates or reopen FT matches.
- Provisional code guard: >=3 verified upstream failures and >=180 seconds of independently verified degradation, with healthy local pipeline/link and fresh alternative observation. **Thresholds not user-approved and require real poll telemetry/tuning.**
- New standalone `lib/match-source-policy.cjs` guard + tests; not connected to routes. Full specification `docs/audit/SPORTS-002-verified-provider-failover.md`.
- Staging gate: outage classification tests (ESPN issue vs Cloudflare scheduler/worker/DB/egress/rate limiting), authentic source timestamps, switching/fencing, live-update dedupe, recovered ESPN reentry, social/settlement safety.

## External Worker consolidation — user-provided topology (2026-10-30)
- Owner disclosed additional external Cloudflare Workers: (1) fast frontend ESPN summary proxy + MOTM D1 votes on live-api.factsport.com, (2) D1 match chat on chat-api.factsport.com, (3) five-minute scheduled FD-sync/settler Worker; separate cron-job.org invokes /api/live every minute for database/background updates. This frontend proxy distinction is essential: **3-second front-end polling does not depend on 1-minute DB cron**.
- Consolidation target: one centrally managed vinext Workers deployment with modular same-origin fast live GET (edge cached 3s), chat, MOTM, and internal scheduled dispatcher; Mkety Core PostgreSQL for data with optional measured special-purpose bindings. Preserve media UX, don't force every live viewer through DB or treat DB-cron delay as ESPN failure.
- Scheduled FT correction must complete/validate before idempotent point settlement: present 2-second overlap in old Worker is no guaranteed dependency. No ?key= public privileged calls.
- M2/M4 requirements: identify external D1 schema, cron configurations and all cross-origin URL consumers; independently verify live cache, chat vote/session identity, provider quota, abuse prevention, and ESPN outage classification.
- **Security:** supplied external Worker contained hardcoded CRON_KEY fallback; do not reproduce; rotate/retire key in safe maintenance change before cutover. Chat POST trusts client user ID and MOTM POST lacks authoritative one-vote-per-user checks. Central auth and anti-spam required.
- Detailed source-backed migration map: `docs/audit/WORKERS-001-external-workers-and-consolidation.md`.

## Azure low-cost + replaceable adapters (2026-10-31)
- Owner asks minimum-cost managed Azure PostgreSQL initially, Azure Logic Apps for automations, Mkety AI for AI output, **without provider lock-in**. The existing Cloudflare/vinext frontend/live remains the primary web platform; one centrally managed system and replaceable infrastructure integrations.
- Research supports Azure PostgreSQL Flexible Server B1ms/32GiB as smallest practical managed starter, subject to measured load, Azure region/currency quote and billing approval. Logic Apps Consumption initially for occasional workflows; evaluate one-minute job economics before assigning high-frequency jobs there. Do not infer near-zero monthly cost.
- Domain ports committed in `lib/ports/contracts.ts`: MatchRepository, JobRunner, JobScheduler, AiProvider, MediaStore. Contract only, not wired to existing application. `docs/audit/CLOUD-001-azure-cost-and-adapters.md` details inventory, pricing caveats, security, cutover/rollback.
- GitHub dev branch only: Azure subscription/creds absent; no billable resources were created; no production data migrated.
- New M3/M4 gates: DB portability tests to Azure PostgreSQL and Mkety Core PostgreSQL, versioned migrations, scheduler interchangeability, Mkety AI adapter protocol, central idempotent job dispatcher and secrets/backup budget.

## Provider refinement — 2026-10-31
- Facebook and Telegram MUST remain direct API integrations. Third-party marketing automation MAY use Azure Logic Apps adapter; Cloudflare Workflows counterpart remains disabled until approved transition.
- Cloudflare R2 is default media storage; Mkety Mail handles transactional email; Mkety AI handles editorial/pro-analysis. Passive AI and Mail adapters committed with verified MkSaaS API contracts.
- Keep Cloudflare 3s live polling and cache intact pending measured cost/reliability evidence (no speculative WebSocket/DO rewrite).
- Start Azure PG B1ms as cheaply as feasible (~$16–20 monthly DB planning target); staging first, production only after validation, keep Azure automations budget separate.
- Prefer Mkety Auth/OIDC identity abstraction and test reuse of existing Zitadel configuration; don't assume ZITADEL free 100-DAU tier will scale. See `docs/audit/CLOUD-002-mkety-integrations-auth-and-cost.md`.

## ZITADEL/Assist AI options assessed — 2026-10-31
- ZITADEL Cloud Free = 100 DAU, Pro from US$100/mo; OSS self-host permits larger usage with own compute/Postgres/TLS/patch/backups and AGPL-3.0 compliance. Low-overhead fallback might be shared Mkety Auth/ZITADEL if spare capacity verified; evaluate Clerk Hobby's published 50,000 free monthly retained users (different billing metric) rather than self-hosting prematurely.
- Proposed alerts: actual unique identity DAU at 60/80/90, weekly trend; begin migration planning early. No account migrations or production monitoring configured.
- MkSaaS Enterprise AI and Assist standalone AI are **distinct routes and entitlements**. Main enterprise POST /api/v1/ai/chat/completions; Assist raw_model POST /v1/chat/completions with mka_ inference key, explicit customer+key allowlists, credits; assistant mode is also supported but distinct.
- Added `lib/adapters/mkety-assist-ai.ts` beside Enterprise `lib/adapters/mkety-ai.ts`, both implement AiProvider; passive code only, untested, no live API calls. See `docs/audit/AUTH-AI-001-zitadel-and-assist-options.md`.

## Factsport isolated Azure external customer tenant (2026-10-31)
- Owner approves staging preparation for Microsoft Entra External ID, insists on zero mixing with Mkety enterprise/workforce tenant. Create new **external-configuration tenant** (not workforce) with separate Factsport users/app registrations/login flows/admins, link existing Azure subscription for billing only; billing free MAU can be aggregated across tenants linked to subscription. No Azure tenant was actually created.
- Comparison official: Entra 50k MAU free core, Google Identity Platform 50k email/social MAU, AWS Cognito 10k direct/social MAU, OCI Free IAM max 2k users without self-registration; OCI External Active User is metered rather than established large free auth. See `AUTH-004-entra-staging-and-cloud-comparison.md`.
- Passive provider-neutral identity contract `lib/ports/auth.ts` added; actual Entra OAuth/PKCE implementation awaits staging tenant, callback, isolated account and tests. No production auth touched.

## Azure staging scaffolding and priced operations (2026-11-01)
- Owner authorized implementation preparation and asked for Cloud Shell provisioning commands, actual Entra >50k MAU rate, moderate Logic Apps cost and sizing. Official Entra pricing page still renders "$-" for overage, so exact per-MAU beyond 50k **NOT verified**; formula + quote path documented. 50k free is combined eligible MAU across subscription-linked tenants.
- Committed `infra/azure/bootstrap-staging.sh` (DRY RUN default, APPLY=1 + typed confirmation, new Factsport staging RG, B1ms 32GiB PG16, 7d backup, no HA, no broad ingress, empty DB only) and `infra/azure/logic-app-staging-disabled.json` (disabled Compose-only harmless Logic Apps template).
- Repro cost tool `scripts/estimate-azure-cost.cjs`: estimated lean US$16.87, moderate US$19.04, busy US$20.76 total Azure PG+Logic Apps example under 50k Entra MAU, excluding networking/R2/CF/AI/mail/backup excess and regional price variance. DB baseline US$16.09 reference pricing, NOT actual selected subscription price.
- Entra external customer tenant must be created via Entra Admin Center separately from main workforce tenant with existing subscription billing; NOT yet created. Actual Azure provisioning / runtime auth remains for human Cloud Shell and staging tests. Full runbook `docs/audit/CLOUD-003-azure-provisioning-and-cost-model.md`.


---

## 2026-11-06 execution status — v2 staging foundation and production plan

The governing roadmap remains this document. The detailed delivery sequence and release gates are in `docs/audit/PRODUCTION-EXECUTION-PLAN.md`. Do not treat a passing infrastructure smoke as completion of M1–M11.

### Verified staging foundation (not production parity)

- The runtime app reader Hyperdrive is intentionally provisioned separately from the original admin/migration Hyperdrive. One-time setup run [41675097638](https://github.com/MketyDigital/Factsport/actions/runs/41675097638) created `factsport-v2-runtime-postgres` ID `895cca4c06104b8ab9f7c1b72a8ba18f`, generated a restricted `factsport_v2_reader` password, verified the connection, and removed temporary bootstrap/probe Workers.
- The schedule writer Hyperdrive `eb634fef8bb443839fd0847c6c370f85` and ESPN live-field writer Hyperdrive `c5166b8496624a80a0a77c750585c271` are separate role-scoped connections. Their setup and permission checks passed (runs [41695514082](https://github.com/MketyDigital/Factsport/actions/runs/41695514082), [42046871411](https://github.com/MketyDigital/Factsport/actions/runs/42046871411), [42047371419](https://github.com/MketyDigital/Factsport/actions/runs/42047371419)).
- Staging schedule imports populated six competitions. The schedule Cron is registered, but actual automatic scheduled invocation/refresh still requires runtime evidence.
- ESPN reconciliation preview returned 18 unique candidate links, but wrote zero links; manual review and an auditable linking operation remain required.
- Native vinext build and protected app staging passed in run [42172478876](https://github.com/MketyDigital/Factsport/actions/runs/42172478876); the Hyperdrive/R2 smoke workflow passed in [42175276021](https://github.com/MketyDigital/Factsport/actions/runs/42175276021).
- The v2 schema is still only the four-table foundation. Full identity, editorial, predictions, settlement, VIP, community, media metadata, jobs/outbox and admin domains are not complete. The staging app does not yet prove end-user feature parity.

### Current implementation follow-up

- Staging `/api/matches` now returns `private, no-store` instead of a public cache directive when the staging environment is active. The staging workflow now tests the cache header and verifies unauthenticated requests remain blocked after an authorized match request. Wait for the new app-staging run before marking this item runtime verified.
- The runtime reader role's initial bootstrap checks only selected negative permissions. Strengthen effective-grant verification (PUBLIC privileges, table/column rights, schema/database rights, role attributes/memberships, functions and sequences) before production sign-off.
- Complete the remaining roadmap milestones in dependency order; preserve the clean operational reset policy and all owner-confirmed provider precedence/adapter decisions.
- No production DNS, production Worker routes, legacy Supabase data, production database permissions or live scheduled jobs were modified by this update.


## Route-level migration register (2026-11-06)

The route-by-route inventory is now recorded in [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md). It records the 25 tracked API routes plus privileged server actions, current dependencies, v2 destination and completion criteria. Use it alongside this roadmap and the production execution plan; route compilation alone is not feature parity.


## Page-level migration register (2026-11-06)

The page and product journey inventory is now recorded in [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md), complementing the [route/API migration matrix](./ROUTE-MIGRATION-MATRIX.md). Use both to track full product parity, not just API compilation.


## Shared component migration register (2026-11-06)

A scan of the 54 shared component files identified 14 direct Supabase dependencies. Track them in [COMPONENT-MIGRATION-MATRIX.md](./COMPONENT-MIGRATION-MATRIX.md) alongside page and route parity.


## Database role and Hyperdrive register (2026-11-06)

The four Hyperdrive resources and the three runtime database roles are mapped in [ROLE-PRIVILEGE-MATRIX.md](./ROLE-PRIVILEGE-MATRIX.md). Use this as the authority when changing Worker bindings or role grants.


## Database/data migration register (2026-11-06)

[DATA-MIGRATION-MATRIX.md](./DATA-MIGRATION-MATRIX.md) records the 18-table legacy inventory, target v2 domains, clean-reset dispositions, preservation exceptions and migration gates. The target remains a full product with fresh transactional data, not a reduced product or blind data copy.

## Staging progress update — 2026-11-06

- Hyperdrive identities are intentionally distinct, not competing IDs: 895cca… is reader/app, eb634… is schedule writer, c516… is reserved ESPN writer, and 08cee… is administrator/bootstrap. The app binding remains on the read-only reader; admin access is confined to provisioning, audit and hardening Workers.
- Staging database role hardening passed in [run 42265651629](https://github.com/MketyDigital/Factsport/actions/runs/42265651629); independent catalog audit passed in [run 42265971339](https://github.com/MketyDigital/Factsport/actions/runs/42265971339). The three runtime roles are NOINHERIT, non-superuser, non-privileged, connection-limited to five, have no role memberships, cannot create TEMP tables, cannot execute public functions or use public sequences, and cannot access private account/identity/job tables. Schedule and ESPN column grants are separate and verified.
- The staging Hyperdrive/R2 smoke passed after the Cloudflare safety script was changed to fail closed when the runtime Hyperdrive identity or safety settings cannot be verified: [run 42281703688](https://github.com/MketyDigital/Factsport/actions/runs/42281703688).
- The v2 /matches page has been changed to use the read-only PostgreSQL adapter for initial server rendering and team form; load-more now sends timestamp plus match UUID for stable keyset pagination. The public API uses an explicit match DTO and dynamic/private staging responses. The protected app staging page/API and cache-isolation checks passed in [run 42283459376](https://github.com/MketyDigital/Factsport/actions/runs/42283459376). Each request-scoped app Hyperdrive client is limited to one connection; Hyperdrive manages the shared backend pool. A follow-up workflow now exercises a real timestamp+UUID cursor against staging data; full page parity is still not complete.
- The staging worker hostname now fails closed if its FACTSPORT_ENVIRONMENT binding is missing or incorrect. This prevents a staging misconfiguration from silently bypassing the access gate.
- These are staging-only changes. No production Worker, production domain/DNS, legacy Supabase data, Azure production firewall, paid entitlements, settlement, or production scheduler was changed.

### Next exact actions

1. Confirm the latest v2-verify, native vinext build, and full app staging runs pass on the current branch head; fix any failure before proceeding.
2. Add PostgreSQL integration coverage for the compound cursor and team alias queries; verify /matches and /api/matches using the real staging Hyperdrive.
3. Continue M1/M2 route/page/component inventory and port the sports lifecycle in order: fixture import → reviewed ESPN linking → fast live read → FT verification → standings → transactional settlement.
4. Implement the remaining product domains and roles (identity/session, admin RBAC/step-up, editorial/CMS, predictions, VIP/payments, community/chat/MOTM, social outbox, mail and video entitlement) with tests and real staging journeys.
5. Do not begin production cutover until all P0/P1 items in PRODUCTION-EXECUTION-PLAN.md, backups/restore, shadow comparison, end-to-end journeys and explicit owner go/no-go are complete.

## 2026-11-07 continuation — legacy source hardening and staging verification

- Current source review and active production workflow evidence are recorded in [handoff M07](./handoffs/M07.md); follow-up code and protected staging verification are recorded in [handoff M08](./handoffs/M08.md).
- Legacy football-data score ingestion no longer fabricates 0–0 from unknown final scores; ESPN-linked live status is protected from the schedule importer, and ESPN cup imports preserve missing scores and settled results.
- The scheduled and manual monthly prize audit now share one qualification engine using verified final scores, configured thresholds, deterministic ranking, and qualified-only drafts. The monthly reset updates both ordinary and prize-eligible counters.
- The five legacy automation scripts now parse under the v2 ESM package mode. The Matchmaker v2 endpoint uses POST Bearer authorization instead of a query-string secret.
- Native Cloudflare build and protected full app staging passed on code head `78a5999986f1a26d2bb1bd84928f2c24726567d1`: [build 42358066708](https://github.com/MketyDigital/Factsport/actions/runs/42358066708), [app staging 42358066680](https://github.com/MketyDigital/Factsport/actions/runs/42358066680). Verified scope includes protected access, Hyperdrive/R2, server-rendered matches, populated matches API, stable timestamp+UUID pagination, private/no-store caching and auth isolation.
- Main-branch production workflows were inspected and observed passing on 2026-11-07; see M07 for exact run IDs and step-level evidence. No main-branch or production changes were made.
- This is still a staging foundation, not feature parity. Continue the full data/domain schema, first-five eligibility, transactional settlement, durable live outbox, auth/admin, editorial/media, VIP/payments, community/video, external Worker migration and complete browser journeys before cutover.


## 2026-11-07 — parity, rebrand and AdSense acceptance contract
The governing acceptance addendum is [V2-PARITY-REBRAND-ADSENSE-ACCEPTANCE.md](./V2-PARITY-REBRAND-ADSENSE-ACCEPTANCE.md). It supplements M1/M8/M10 and the route/page/component matrices. No existing feature, logic, integration, brand asset or monetization capability may be silently removed. The full responsive redesign must retain the existing Factsport logo, favicon/app-icon files, navy/red/neutral brand identity, and Lucide icon language unless the owner approves a brand change. AdSense is a formal release gate: verify the live ads.txt/account, review sportsbook affiliate and VIP/prize mechanics against current Google publisher restrictions, correct Cloudflare robots/sitemap behavior, keep Google ads away from interactive/private surfaces, and do not claim acceptance until Google's site status is Ready. The addendum records the current 1xBet promotional surfaces, timed modal, VIP-prize eligibility copy, existing ads.txt seller record, absence of an AdSense code implementation in inspected source, and Vercel-dependent robots logic as items to remediate/review.


## 2026-11-07 owner priority reset — public football media first

The owner has reconfirmed that **the primary V2 product is the public Factsport football-media platform at `factsport.com/*`**. Free predictions are a supporting feature, not the main delivery focus. All engineering work remains on `refactor/factsport-v2` through cutover readiness.

### Priority order
1. **Public media and sports core (P0):** homepage/editorial experience, news and article publishing, fixtures/results, live scores, match centre, standings, tournaments, highlights/video, SEO/metadata, mobile UX, performance and accessibility. Preserve ESPN live path, football-data fixture coverage, arbitration and every existing sports/media capability.
2. **Editorial and operations platform (P0):** CMS author/review/publish, media ingestion and rights/provenance, admin/RBAC, settings, reliable schedules/jobs, social publishing/outbox, observability and content safety.
3. **Shared platform foundations (P0):** complete PostgreSQL domain/read models, R2 MediaStore, server APIs, provider adapters, identity/security boundaries and removal of runtime Supabase dependencies from migrated surfaces.
4. **Private Predict/business system (P1):** registered account, VIP entitlements, premium predictions, campaigns, payments, prizes, betting slips and admin workflows; preserve full feature parity and isolate from public AdSense surfaces.
5. **Public free predictions (P2 supporting feature):** implement after core public media journeys are stable. This feature must not displace media/CMS/live work.
6. **Cutover readiness:** complete all parity, data, security, restore, shadow comparison, SEO/AdSense and operational gates before explicit production go/no-go.

### Returning free-prediction email deduplication
- Keep one `prediction_contacts` row per normalized email using its unique constraint and transactional upsert; email normalization must be deterministic (trim whitespace and lowercase; do not apply provider-specific dot/plus rewriting).
- On the same browser, a valid first-party HttpOnly participant cookie identifies the existing participant so repeat predictions do not ask for or resubmit email.
- On another browser/device or after cookie loss, email entry may resolve/reuse the contact row, but must not merge participant identities, prediction histories or account ownership. Do not use email as an authentication or claim key.
- Allow more than one participant identity to reference one contact where necessary; the database must not enforce unique contact_id on participants. A single normalized contact row prevents duplicate email-list entries.
- Keep one marketing subscription per contact/channel/purpose. Repeated opt-ins must not create duplicate subscriptions or resend confirmation indiscriminately; withdrawn/unsubscribed state must not be silently reactivated without a new explicit opt-in event. Marketing remains optional and distinct from prediction participation.
- Keep database cost low: indexed unique normalized email, indexed participant contact foreign key, unique subscription key and transactional upserts; no separate email-identity service or duplicate contact table.

The existing page, route, component and data migration matrices remain the source of truth for individual migration scope. Do not mark a page complete merely because its route compiles: require its real content, interactions, loading/error/empty states, mobile behavior, SEO and data freshness to pass staging journeys.

No production resources or legacy data were changed by this priority update.


## 2026-11-07 continued implementation — editorial hardening and homepage read models

The implementation remains on \`refactor/factsport-v2\` and follows the media-first priority reset above.

- **Editorial provenance/review:** migration 0005 adds explicit origin values (\`manual\`, \`ai_assisted\`, \`automated\`, \`imported\`, \`unknown\`), original timestamps, SEO/reverification metadata and distinct legacy \`body\`/\`content\` preservation fields. A published article must have an approved review state, identified reviewer and review timestamp. Public media requires a recorded rights review.
- **Homepage sports read models:** migration 0006 adds featured-match metadata, a safe homepage setting view, season/group-aware standings, and provider-locked YouTube/Vimeo highlights with rights review and optional R2 thumbnails. The public reader receives only narrow views.
- **Hyperdrive lifecycle (supersedes the earlier isolate-wide client):** each database adapter operation now creates and closes a request-scoped postgres.js client (max one connection per client); Hyperdrive owns and reuses its managed pool. Never cache a postgres.js client in module scope across Worker requests. Static SQL projections preserve prepared statements.
- **Public pages:** homepage now has opt-in PostgreSQL reads for the main match window, featured matches and rights-cleared highlights; news/article have opt-in published/reviewed PostgreSQL reads; homepage mini standings can use the new standings view. \`HomeDashboardClient\` no longer queries Supabase directly for featured-match settings.
- **Editorial security/SEO:** raw article HTML passes through \`rehype-sanitize\`; iframe embeds are restricted to HTTPS YouTube, YouTube-nocookie and Vimeo player hosts. Existing match-widget tokens use a dedicated safe protocol. NewsArticle JSON-LD escapes script-breaking characters; reviewed SEO title/description/canonical and article author are projected.
- **Known gaps:** the full \`/highlights\` and \`/standings\` routes remain legacy-backed; Bet of the Day's \`pro_analysis\` and public affiliate/config settings need V2 models; CMS writes/review/publish, media ingestion and rights operations are not yet implemented. These are not complete pages.
- **Migration state:** migrations 0004-0006 and their tests are committed but unapplied. No legacy article bodies, match history or media have been imported. No production resource or data has been changed. Staging migration, role verification, content preservation classification and browser parity remain gates.


## 2026-11-07 competition read paths — highlights and standings

- Added migration 0007 for current-season player goals/assists, stable player IDs, team identity and provider freshness; public reader receives a narrow view only.
- Full \`/highlights\` page now supports opt-in PostgreSQL pagination, league filters, source-video canonical links and rights-cleared R2 thumbnails. Legacy fallback remains.
- Full \`/standings\` page now supports opt-in PostgreSQL standings, same-season completed-match form and a goals/assists leaders API. \`LeagueLeaders\` no longer queries Supabase directly in the browser.
- Added \`matches.season\` and a bounded final-results index; form calculations are isolated to the selected current season.
- No current-season rows are imported or fabricated. Migrations 0004-0007 are committed but unapplied. Provider ingestion, stats reconciliation, tie-break parity, team-crest rights mapping, live refresh and staging data evidence remain required.


### Migration-specific public read flags

Keep each read path disabled until its exact schema and reader grants are applied in isolated staging:

- \`FACTSPORT_MATCHES_BACKEND=postgres\`: base matches read model from migration 0001 only; must not select season or newer homepage/competition views.
- \`FACTSPORT_EDITORIAL_BACKEND=postgres\`: reviewed articles and rights-cleared media; requires 0004-0005.
- \`FACTSPORT_HOMEPAGE_BACKEND=postgres\`: featured matches and safe homepage settings; requires 0006.
- \`FACTSPORT_HIGHLIGHTS_BACKEND=postgres\`: full highlights page and reviewed video metadata; requires 0006.
- \`FACTSPORT_COMPETITIONS_BACKEND=postgres\`: standings, same-season form and player leaders; requires 0006-0007.

Do not use one broad match flag to activate later schema surfaces. This separation was added after protected staging correctly exposed that the base match reader must remain compatible with the base schema while 0006 is still unapplied.


### Protected staging finding — base match reader / migration boundary

The protected staging run on commit \`24484f5\` built and deployed the Worker but returned HTTP 500 on the authorized \`/matches\` page. Source inspection found that the base \`MATCH_SELECT\` projection had accidentally started selecting \`matches.season\`, which is introduced only by migration 0006 and is not present in the currently provisioned staging schema. The column was removed from the base match projection; season remains selected only by the competition-results reader behind \`FACTSPORT_COMPETITIONS_BACKEND\`. New homepage/highlights/competition flags are now separate from \`FACTSPORT_MATCHES_BACKEND\`. A fresh protected staging run on the corrected code is pending. The earlier keyset-pagination 503 still needs a fresh probe after the page render succeeds.


## 2026-11-07 competition directory and live standings continuation

- Added a dedicated competition directory and a bounded base-schema league match reader; tournament fixtures can be read through a same-origin allowlisted API when the base matches backend flag is enabled.
- LiveStandings now reads both competition matches and standings through same-origin APIs rather than querying Supabase directly from the browser, with a 15-second refresh.
- The earlier temporary restoration of public Adsterra/BettingPromo placements is superseded by the owner-approved AdSense-first public/private split in Sections 10–11 of the governing acceptance contract. Public Media must not render bookmaker/affiliate promotion or cash-prize/betting-slip inducements; retain the underlying affiliate and VIP business capability in the private product. No AdSense integration or approval is claimed.
- Added regression coverage for tournament directory/detail, public API projections, browser database isolation and monetization-placement preservation.
- The corrected tournament directory JSX and public promo test have been committed. Build/verification for the latest revision must pass before this slice is considered validated; migrations 0004-0007 remain unapplied and no production change was made.

## 2026-11-07 verified competition/live-standings slice

- Native Vinext build passed on 37281e9d141b88f0e3f22409fb49d7b045a0956f (run 42382907761).
- Protected staging passed on that commit (run 42382907988): Worker build/deploy, deny-by-default, authorized /matches page render, stable timestamp+UUID pagination and authentication/cache isolation passed.
- The first authorized match API request returned a transient 503; the retry returned a populated result and pagination succeeded. Treat the cold-start/transient failure as an operational reliability item, not as an unqualified clean pass.
- Isolated verification passed on 1afe964c2d0a3a0d71655a4cc95334377a3c100e (run 42383032967), including the engine regression suite, TypeScript, prediction/consent schema contracts and migration inventory.
- Staging test coverage is still focused on the existing matches endpoint; the new tournament endpoints and feature-flagged standings reads need their own authenticated integration probes once the matching migrations and current-season data are provisioned.
- No migrations 0004-0007 were applied, no legacy data imported, and no production resources changed.


### Monetization placement preservation

The acceptance contract prohibits silent removal of monetization. Existing public placements have been restored on the V2 branch and the test suite now guards their expected counts. Any later change to affiliate inventory or placement requires an explicit product/legal decision.

## 2026-11-07 Hyperdrive lifecycle correction — M11

- Intermittent staging 503s were investigated. The app had a module-scoped postgres.js client reused across Worker requests, and the match reader used sql.unsafe() for its dynamic projection. Both were removed: adapters now use a request-scoped client closed in finally, and static SELECT projections preserve prepared statements.
- Isolated verification passed on 3ed1df5 (run 42383870339); native Vinext build passed (run 42383870315).
- Protected staging passed (run 42383870331): deny-by-default, Hyperdrive/R2 health, /matches initial render, timestamp+UUID cursor pagination without duplicate row, and auth/cache isolation all passed. The pagination 503 did not reproduce after the lifecycle change.
- Continue monitoring transient database errors; a successful rerun is not a guarantee against future infrastructure failures.
- Main /match/[id] remains a legacy path until canonical legacy-ID crosswalk, prediction/campaign parity, server-authorized stream grants, VIP analysis RBAC, ticker and settings reads are complete. See M11.


## 2026-11-07 match identity foundation

- Added migration 0008 with a nullable unique legacy match UUID alias while preserving canonical V2 matches.id.
- Added getPostgresMatchById() to resolve either V2 or legacy UUID and return the canonical V2 match ID.
- Added a separately gated PostgreSQL branch to GET /api/match/[id] with a narrow public DTO. Media URLs, campaign IDs, pro-analysis, affiliate links and settlement fields are excluded.
- The main /match/[id] page remains legacy-backed. Do not enable FACTSPORT_MATCH_DETAIL_BACKEND until the alias is populated through approved reconciliation and the separate stream entitlement, VIP analysis, campaign/prediction and ticker/settings contracts are complete.

## 2026-11-07 M12 match-centre access hardening checkpoint

- Added server-side playback unlock and VIP analysis APIs; client components no longer receive raw stream URLs or VIP analysis as initial page props.
- Restricted match-detail client DTO and site-settings projection; preserved video/audio/streamio modes and existing legacy prediction/affiliate child journeys.
- Isolated verification (42385395641), native vinext build (42385395567), and protected staging (42385395586) passed on 45d5cd3b4a5fcd39ab33e1eb58bdf47ba40c5ecd.
- Evidence scope: staging verifies the existing /matches PostgreSQL path, not the new match-detail endpoints. Those are source/test/build verified only and still read legacy Supabase.
- M11 match-centre migration gate remains OPEN: signed short-lived playback grant or controlled proxy, V2 entitlement/RBAC, canonical/legacy alias population, prediction/campaign parity, ticker/settings API migration, full child-component contracts and browser E2E are outstanding. No DB migration or production change was made.

### M12 verification follow-up — 2026-11-07

The latest match-centre source hardening commit is `ab3e924f29766f42ad35210ffd75e23892e58896`. Unknown match statuses no longer count as live for match-page metadata or playback; postponed/cancelled states do not release a stream. Relative media paths remain same-origin and the existing streamio mode is retained. Isolated verification passed (42386252137: 104 engine tests and 5 ingestion tests), native vinext build passed (42386252158), and protected staging passed (42386252101). The staging workflow still does not exercise the new match-detail endpoints, so match-centre runtime parity remains OPEN.

## 2026-11-08 CMS/media, CI and policy checkpoint

The governing acceptance contract's owner-approved public/private separation supersedes the earlier temporary affiliate-placement restoration note in the 2026-11-07 competition continuation below. The public Factsport Media surface must not render bookmaker banners, betting affiliate CTAs, betting-slip claims or cash-prize inducements. Preserve the underlying VIP, affiliate, campaign, payment and settlement capability in the separately controlled private product; this is separation, not deletion. Any future public promotion requires a new explicit owner and policy/legal review.

- Branch head at this checkpoint: `785b0062ee4816116fabd7df2e7868d1d284ccea`. The latest application code slice is `5a6f4a86e27b7d27c20eb2c73d21b3a3534d6957`.
- Implemented source slice: Media newsroom draft/revision/review/publish/archive, distinct author/reviewer/publisher authorization, private R2 image upload/preview, rights review and revision-scoped attachment, media library, social outbox and public-media attestation. Migrations 0009–0026 are committed but remain unapplied.
- The earlier application slice passed on code commit 5a6f4a8: isolated verification [42461455150](https://github.com/MketyDigital/Factsport/actions/runs/42461455150), native build [42461455356](https://github.com/MketyDigital/Factsport/actions/runs/42461455356), protected staging [42461455140](https://github.com/MketyDigital/Factsport/actions/runs/42461455140). The corrected migration-guard commit c846201 also passed isolated verification [42463637375](https://github.com/MketyDigital/Factsport/actions/runs/42463637375), native build [42463637427](https://github.com/MketyDigital/Factsport/actions/runs/42463637427) and protected staging [42463637373](https://github.com/MketyDigital/Factsport/actions/runs/42463637373). Runtime scope remains health/Hyperdrive/R2, deny-by-default, PostgreSQL-backed /matches, /api/matches keyset pagination and auth/cache isolation only; CMS/media runtime remains unverified.
- A follow-up CI guard now inventories migrations 0001–0026 and specifically checks announcement settings, editorial-writer grants and the fail-closed 0026 attestation preflight. Initial attempts exposed a regex error, YAML indentation error and a transaction-header assertion issue; these were corrected on `c8462017270b6f54e6633181f3c16b0797be2db6`. Isolated verification [42463637375](https://github.com/MketyDigital/Factsport/actions/runs/42463637375), native Vinext build [42463637427](https://github.com/MketyDigital/Factsport/actions/runs/42463637427) and protected staging [42463637373](https://github.com/MketyDigital/Factsport/actions/runs/42463637373) all passed.
- **BLOCKED — identity:** Entra External ID tenant/client/redirect/session integration is not configured in staging. The Media admin login still has a legacy allowlist and a private-host login mismatch.
- **BLOCKED — database:** editorial writer Hyperdrive/role/grants and migrations 0004–0026 have not been runtime-verified on isolated staging. Migration 0026 requires explicit reconciliation of existing social/publication attestations.
- **OPEN — media operations:** public-renderer CMS preview, image transforms/reuse/ordering, revision diff/restore, R2 upload/rights revocation and end-to-end author→reviewer→publisher journey.
- **AdSense recheck (2026-11-08):** Google's Publisher Restrictions still classify online gambling, including bookmaker/affiliate promotion, as restricted inventory; Nigeria is not in the exclusion-country list. Google's advertiser certification rules are separate and were updated 14 October 2026 to add Enugu and Imo to eligible Nigerian states. Current production factsport.com still publicly displays a 1xBet bonus banner, VIP betting-slip/win-rate claims, crypto payment instructions and VIP-only cash-prize eligibility. The live Privacy Policy also claims no third-party advertising cookies. Production is not AdSense-ready; actual AdSense “Ready” status and live ads.txt seller authorization remain owner-verification items.
- Public V2 code tests block bookmaker promotion from public Media and private-host gate VIP/prize routes. The current live production site is still legacy; no production cutover has occurred.
- **Next:** complete current CI, provision isolated staging migrations and writer grants, configure Entra staging, run CMS/media and social journeys, then finish sports/match-centre and private Prediction parity before release gates.
- No production DNS, Workers/routes, databases, Supabase permissions/data/secrets, schedules, AdSense code or legacy source data were changed.



## 2026-11-09 Media implementation continuation — M35–M40

This section supersedes the 2026-11-08 OPEN media-operations bullets where the same work is now implemented in source. It does not supersede staging, migration, identity, policy or production gates.

- **Studio/broadcast:** M35 adds signed Stream webhook reconciliation, active participant presence, admin blocking, token-identity revocation and fail-closed host/moderator demotion/regrant. The broadcast schema and admin operations remain unapplied/unprovisioned; no Stream production room was activated.
- **CMS media:** social image attachments now accept up to four rights-cleared public images, include media IDs in idempotency checks, revalidate rights/expiry/public attachment at schedule and dispatch time, and require an explicit per-channel media capability (default false). Meta is limited to one image until multi-photo E2E; Telegram caption, destination and 5 MB URL-image limits are enforced.
- **Editorial provenance:** source references are append-only and revision-scoped. Draft revisions inherit the previous draft/published source list; restore carries sources forward. Public source links appear only for the latest published revision and exclude private rights-reference notes. Migrations 0033/0035 implement the published-only view and composite article/revision integrity.
- **Social channel admin:** M39 adds role-gated non-secret account routing settings. Access tokens, bot tokens and webhook URLs cannot be entered in channel settings. Channel activation requires dispatcher/provider readiness; image capability requires provider-specific E2E readiness.
- **Social dispatch:** M38/M40 add a dedicated dispatcher Hyperdrive adapter, protected claim/deliver/result endpoints, SKIP LOCKED leases, a single-provider-call lock, delivery receipts, bounded retry/backoff and dead-letter/unknown-result handling. Meta and Telegram direct adapters are source-implemented; Buffer/Make route through an HTTPS bearer-authenticated Logic Apps/APIM adapter. A sequential Logic Apps recurrence workflow template exists but is disabled by default.
- **Migrations:** the CI inventory now covers 0001–0037. Migrations 0027–0037 are committed but not applied. This inventory is a presence/contract check, not a PostgreSQL migration-apply proof.
- **CI/runtime evidence:** earlier social attachment and dispatch-core slices passed isolated/native checks as documented in M37/M38. The latest M40 provider-delivery, channel-admin and revision-scoped source changes require their own fresh native build and isolated regression pass; provider E2E is not complete. Protected staging has not proven CMS, social dispatch, source provenance or Studio runtime parity.
- **AdSense:** public Media remains separated from private Prediction/VIP/payment/admin surfaces. These code changes do not implement Google ad serving, prove ads.txt on the live host, prove consent/CMP readiness or establish AdSense approval. The live production site and owner account checks remain separate gates.
- **Next:** complete current CI; verify migrations 0027–0037 and dedicated roles/Hyperdrives on isolated staging; configure Entra and Logic Apps/APIM securely; run full newsroom source/media/rights review, Studio Stream and private provider-destination social E2E; add operator reconciliation UI; then complete AdSense legal/consent/live-domain acceptance. No production change is authorized or claimed.
