Warning: truncated output (original token count: 29058)
Total output lines: 728

# Factsport modernization — master roadmap
Status: V2 refactor active; full clean-start database migration chain applied to factsport_v2 on 2026-11-18; broader Media/Prediction acceptance and production remain open | Repository: MketyDigital/Factsport | Branch: refactor/factsport-v2
Updated: 2026-11-18

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
- [x] **M74 visual foundation — SOURCE COMMITTED, NOT RELEASE VERIFIED:** reuse existing match/pitch/timeline/OG UI; add lightweight shared CSS 2.5D elevation, accessible statistics cards that preserve missing data, higher-quality homepage hero/fixture cards, visual standings rank/points/form, and branded standings Open Graph preview using the existing generator. See `docs/audit/handoffs/M74-MEDIA-VISUAL-SYSTEM-MATCH-CENTER-AND-SHARE.md`.
- [ ] **M74-A match center:** enhance scoreboard hero/competition and match status presentation, 2D pitch positioning/responsive bench, event timeline, momentum only where source data is independently available, and stat comparisons; preserve live polling, clock semantics, Stream.io, chat, MOTM and separate Prediction tab ownership.
- [ ] **M74-B homepage and fixture browsing:** image-led editorial hero, featured live fixtures, responsive 2.5D match cards, compact scores/form, highlights, league snapshots, loading/empty states; preserve canonical match IDs, SEO text and AdSense-safe placement.
- [ ] **M74-C standings/league pages:** real rank/points/form chips, promotion/relegation state only from verified competition rules, group/knockout support, mobile readable layout, optional real trend visuals; never imply verified movements without data.
- [ ] **M74-D share templates:** extend existing `/api/og` for approved Media article, preview, live, FT, lineup, standings and MOTM templates. Use authoritative public data, rights-reviewed logos/images, correct social dimensions and canonical URL, no generated fictitious outcomes, and distinct Prediction/Media branding.
- [ ] **M74-E quality:** responsive 320px to desktop, keyboard/screen reader labels, reduced motion, color contrast, image alt, no layout shift, measured Core Web Vitals, CDN/OG crawler compatibility, cache/version/expiry, rights revocation, no autoplay/heavy WebGL by default.
Gate: full route-to-component acceptance on homepage, matches, standings, match-details (every tab), news, previews/social and mobile, with screenshot review and controlled staging, alongside editorial/AdSense compliance.

### M9 — games, community, VIP enhancement
- [ ] Preserve existing prediction engines and documented How-to-Play requirements.
- [ ] Expose transparent rule progress; qualify rewards correctly; protect admin operations.
Gate: score reconciliation and eligibility tests passing.

### M75 — guest fan-rating completion and CI source-repair milestone
- [x] Recover successful GitHub isolated verification and Vinext build on `eb228e89` after identifying actual failures in prior M74 source/test contracts, restoring TypeScript-safe editorial rights and visitor-cookie logic. See `docs/audit/handoffs/M75-V2-ROUNDUP-CI-AND-ANONYMOUS-RATINGS.md`.
- [x] Replace active match-detail Player Ratings external Worker URL with a **disabled-by-default, PostgreSQL-only and account-free** Media feature (migration 0048, visitor cookie, Turnstile, reader totals, duplicate-per-player vote constraint, private vote-state reader).
- [ ] Latest-head verification: run test:engine/typecheck/Vinext and protected Cloudflare staging after M75, including SQL acceptance and role denial. Source commit alone does not mean ready.
- [ ] Audit all remaining runtime external Worker calls; no active D1 in V2. Keep existing legacy files for reference and preserve legitimate media data rewriting.
- [ ] Complete full M74 visual all-tabs/Media pages and branded social templates before release.
Gate: verified match/prediction/rights parity and owner-approved staging cutover; no production activation by a documentation or source commit.

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


## 2026-11…7058 tokens truncated…obe requiring the exact `factsport_v2_prediction_api` role, the matches/contact/participant/prediction schema objects and the minimum effective grants for anonymous submission.
- Added static regression tests for the separate database identity and readiness contract.
- Source commits: `184519eea565d5b84e75ff771170970c86475b67` and `6f083d51a8738fb8c69953e92b51c528951ed551`. Isolated verification and native build were running at handoff; no pass is claimed until complete.
- This is only a connection boundary. No prediction API, visitor cookie, role/grants, campaign, claim, settlement or public UI was activated. Dedicated role/Hyperdrive provisioning and isolated DB grant tests are still required.
- Full next actions and rollback are recorded in `docs/audit/handoffs/M48-PREDICTION-DATABASE-RUNTIME-BOUNDARY.md`.

- Follow-up: isolated regression passed on `6f083d51a8738fb8c69953e92b51c528951ed551` (run `42576199656`). Disposable PostgreSQL migration CI now seeds the Prediction API role as a NOLOGIN fixture so the upcoming grant migration can be tested without provisioning an Azure login; run `42576290658` was in progress. This does not provision staging credentials or grants.
- Follow-up verification: native Vinext build passed on `6f083d51a8738fb8c69953e92b51c528951ed551` (run `42576199686`); disposable PostgreSQL migration chain passed on `84b9ee27f58439582cb534441ecc1149b1ba51aa` (run `42576290658`), applying 0001–0042 and validating existing Media/VOD/social grants. This does not test Prediction grants because no Prediction grant migration has been added. Protected application staging was still in progress.


## 2026-11-09 Prediction submission security preflight — M49

- Re-read the actual core/prediction migrations, match-status normalization, AUTH-005 contract, public middleware and Prediction runtime adapter.
- Confirmed the submission API, visitor cookie and rate-limit path are still absent. The current readiness probe's direct table-grant requirement is broader than the preferred least-privilege target.
- Target: a narrowly scoped SECURITY DEFINER submission function with fixed safe search_path, fully qualified SQL, PUBLIC EXECUTE revoked, and EXECUTE granted only to the dedicated Prediction API role. The API role should not receive general contact/participant/prediction table writes.
- Match admission must use a strict scheduled/pre-match status allowlist plus a database-time kickoff check; reject unknown, live and terminal states. Contact reuse is by opaque same-browser visitor cookie, not email-based history transfer.
- Exact evidence, risks and acceptance criteria: `docs/audit/handoffs/M49-PREDICTION-SUBMISSION-PREFLIGHT.md`.
- Audit/design only: no SQL, route, cookie, rate limiter, staging resource or production resource changed. Next: implement and disposable-PostgreSQL-test the scoped submission function, then replace readiness checks and wire the API.


### M49 implementation continuation — scoped Prediction submit function

- Added migration 0043 with a SECURITY DEFINER anonymous submission function, pinned search_path, per-visitor transaction lock, match row lock, strict scheduled/pre-match plus database-time kickoff enforcement, participant reuse and duplicate retry recognition.
- The dedicated API role receives EXECUTE only; the migration adds no direct table grants. Anonymous rows remain prize-ineligible.
- Prediction runtime readiness now checks function existence and EXECUTE privilege rather than broad table-level write grants.
- Disposable PostgreSQL CI now targets 43 migrations and includes ACL/role/function/duplicate-retry assertions. The new run must complete before this is marked DB/runtime verified.
- API route, visitor cookie, rate limiting, marketing confirmation, public UI, campaign engine, account claim and settlement are still not implemented. No staging/production DB was changed.
- See `docs/audit/handoffs/M49-PREDICTION-SUBMISSION-PREFLIGHT.md`.


### M49 implementation continuation — anonymous Prediction API and visitor flow

- Added migration 0043's scoped SECURITY DEFINER submission, visitor-state and rate-limit functions. The dedicated API role receives EXECUTE only; no direct table access is intended.
- Added host-gated same-origin GET/POST API, opaque Secure/HttpOnly visitor cookie, HMAC-keyed visitor/network rate limits, exact versioned rules acceptance and optional pending marketing consent.
- Added a submit-triggered free-prediction form to match pages behind `FACTSPORT_PREDICTION_SUBMISSION_READY`. Email is hidden until Submit Prediction and omitted for a known browser participant. Legacy PredictionBoard and campaign/bonus/settlement logic remain untouched.
- Final SQL/CI, typecheck and Worker build fixes are still being verified at current branch head. Earlier failures were traced to a malformed test dollar-quote/visitor-state block, a SQL email-regex escape and static-test/type errors; do not mark current implementation green until the latest runs complete.
- No role login, Hyperdrive binding, HMAC secret, staging database migration, feature flag, production deployment or DNS change was activated.
- Outstanding before enablement: current-head CI, isolated staging DB provisioning/application, browser E2E, marketing confirmation/unsubscribe, public own-prediction/leaderboard reads, legacy campaign/bonus mapping and scoring/VIP/monthly parity.
- Detailed evidence and acceptance gaps: `docs/audit/handoffs/M49-PREDICTION-SUBMISSION-PREFLIGHT.md`.


- **Parity refinement:** the actual legacy PredictionBoard defaults `require_score=true` outside a campaign. The new public submission path now enforces both exact-score values; campaign-specific optional-score rules remain disabled until mapped.
- **Additional DB coverage:** same email/different visitor identity separation, live/unknown/kickoff-equality rejection, and concurrent same-token race tests are included in the current disposable PostgreSQL workflow. The latest race-test run is pending.
- **Marketing boundary:** opt-in only creates a pending-confirmation subscription and append-only event. No promotional or confirmation email is sent yet; confirmation/unsubscribe/withdrawal and reliable mail delivery remain required.


- **Prediction concurrency/host follow-up:** disposable PostgreSQL run `42582368633` passed concurrent same-visitor/same-match requests (one participant/one prediction), same-email cross-browser separation, kickoff equality, live/unknown rejection, pending consent and rate-limit checks. Production API host is now pinned to `factsport.com`, never the private Predict host.
- **Application checks:** isolated verification and native Vinext build passed on `4aa20c507bbdbf743b2f1e7c72f04e5cd5733e11`; protected staging for that commit was still running. A final CI-only assertion for zero direct public-schema table grants is pending.


- **M49 verification closeout:** disposable PostgreSQL run `42582443798` passed migration 0001–0043, execute-only Prediction role (zero direct public table grants), rules/consent, rate limits, kickoff/status, same-email/different-browser and concurrent same-visitor race assertions. Isolated verification, native Vinext build and protected Cloudflare staging passed on `4aa20c507bbdbf743b2f1e7c72f04e5cd5733e11` (runs `42582325642`, `42582325545`, `42582325595`). No isolated Azure DB migration/role/Hyperdrive provisioning or feature activation occurred. The exact closeout is in `docs/audit/handoffs/M49-PREDICTION-SUBMISSION-PREFLIGHT.md`.


## 2026-11-09 Resumable Cloudflare Stream VOD uploads — M50

- Added the missing large-file TUS upload path. Under-200MB files retain the basic direct upload; files at/above 200MB use TUS automatically, and editors can opt into TUS for smaller files on unreliable connections.
- Uses `tus-js-client@4.3.1`, 50 MiB chunks, bounded retry, stored upload URLs for resume, and expiry-aware restart. Video bytes go directly from browser to Cloudflare Stream; the Worker provisions the upload URL and never proxies the file body.
- TUS creation is admin- and same-origin-protected, validates file metadata/size/type/duration, keeps the Cloudflare API token server-side, and returns the one-time upload URL only in the TUS Location header.
- Migration 0041 records upload protocol and expected byte size. Refresh verifies actual provider size before marking ready; mismatch fails closed and cleans up the provider asset. Stream assets remain signed/private and rights review remains mandatory.
- Re-audit also removed an orphan duplicate SQL tail after migration 0041's COMMIT, restoring a single clean transaction. This migration has not been applied to Azure staging or production.
- M50 handoff: `docs/audit/handoffs/M50-RESUMABLE-CLOUDFLARE-STREAM-UPLOADS.md`. Current-head isolated/native/protected staging verification is pending; no live Stream upload or provider E2E is claimed.


- **M50 verification update:** isolated verification passed with 226 regression tests and TypeScript on `e3dac371fa40293ae73e0a1c75c1cd78419b6fff` (run `42584448535`); native Vinext build passed (run `42584448487`). Protected Cloudflare staging deployment/deny-by-default checks were still in progress. Disposable PostgreSQL migration chain including the revised 0041 VOD size/protocol columns passed on `55464ea4a8d3000a836d109d1ad4c20397922d50` (run `42584159460`). No Stream upload or Azure staging DB migration was performed.


- **M50 protected staging closeout:** Cloudflare staging deployment and deny-by-default checks passed on `e3dac371fa40293ae73e0a1c75c1cd78419b6fff` (run `42584448515`). M50 source/build is verified, but actual Stream TUS/browser/provider E2E and isolated Azure migration remain OPEN. Keep `FACTSPORT_MEDIA_VIDEO_SCHEMA_READY` and `FACTSPORT_STREAM_VIDEO_READY` unset until owner-provisioned staging acceptance. See `docs/audit/handoffs/M50-RESUMABLE-CLOUDFLARE-STREAM-UPLOADS.md`.


### 2026-11-09 M51 media derivatives CI triage

- Rechecked branch HEAD `7e9c983b0cc93fb1c7e75e3e99b92a08f44b476f`: isolated verification `42587739334`, native Vinext build `42587739501`, and protected staging `42587739398` all **failed** at TypeScript, not at a runtime staging acceptance test. Errors in `app/api/admin/media/derivatives/route.ts` were TS2345 on `crypto.subtle.digest` and TS2339 on R2 object `size`/`arrayBuffer`.
- Bounded branch-only fixes: `d9afd7b95d518ec5dc5aff3c280aacd887ffd6cd` narrows the R2 `get` object type to the size and arrayBuffer contract; `5d552c017cd01ddaaca4d4bcf4ca6d3b2f3a2232` copies digest bytes into an ArrayBuffer-backed typed array. These changes do not enable derivative routes, touch production, or relax rights checks. **Current-head CI pending**; do not mark derivatives source-verified until passing runs.
- M50 TUS earlier isolated/native/protected staging checks passed on `e3dac371fa40293ae73e0a1c75c1cd78419b6fff`, but actual Stream provider/browser resumable upload remains unverified. New M51 derivative path likewise needs isolated Azure migration/roles, R2 rights and byte-integrity E2E, malformed/oversized image cases, and rollback checks before activation.
- All P0 media/sports, editorial/identity, P1 private business, P2 public free-prediction and AdSense release gates remain OPEN absent runtime-appropriate evidence. Owner decisions still required for Entra staging credentials, isolated Azure resources, private-host and VIP/prize legal treatment, and AdSense account Ready verification. Preserve legacy source and paid/identity/editorial obligations under separate disposition review.


### 2026-11-10 M51 verification reconciliation — CI green, runtime gates still open

- Re-read issue #288, the governing acceptance contract, production execution plan, public page/route/component migration matrices, M50 handoff, and V2 branch HEAD before recording this checkpoint. Branch HEAD at this check: `75502e03b33a52b4f27407cf1799310c7c83f774` (documentation-only; previous M51 code fix `5d552c017cd01ddaaca4d4bcf4ca6d3b2f3a2232`).
- The three previously pending corrected M51 workflows have now **completed successfully**: isolated verification [42591208216](https://github.com/MketyDigital/Factsport/actions/runs/42591208216), native Vinext build [42591208379](https://github.com/MketyDigital/Factsport/actions/runs/42591208379), and protected staging [42591208469](https://github.com/MketyDigital/Factsport/actions/runs/42591208469). These replace the earlier failed M51 TypeScript runs as source/build/protected-deployment evidence, **not** as media-derivative runtime proof. Workflow job conclusions were checked directly.
- **P0 public sports/editorial:** existing protected staging probes establish the matches read slice only; homepage/news/CMS, match detail, ESPN-linked live lifecycle, FD fallback, standings/tournaments, highlights, video and responsive/SEO journeys remain OPEN until isolated staging end-to-end evidence. **P0 operations/foundations:** Azure migration/roles/backup-restore, Entra Media-host sessions, editorial publishing, R2 derivative integrity/rights, Stream TUS/provider E2E, social/AI/Mail, jobs/retention and observability remain OPEN. **P1 private business:** account, VIP, payment, prizes, campaigns, points/settlement/monthly audit, betting slips, chat/MOTM/match pins and entitlement parity remain OPEN. **P2 free prediction:** disposable PostgreSQL and source contracts do not prove Azure staging submission, visitor browser E2E, marketing confirmation/unsubscribe or scoring parity. **Release:** security, load, accessibility, full match lifecycle, SEO, AdSense account Ready, policy/legal and rollback remain OPEN.
- No safe staging runtime enablement is authorized by these CI results: isolated Azure DB identity and restore, required migrations/grants, Entra tenant/client, Cloudflare Stream/R2 test credentials and provider test paths have not been evidenced. Do not set media/video/prediction readiness flags or weaken guards. No speculative code change is justified without those prerequisites.
- Next bounded acceptance action: (1) obtain isolated Azure staging DB identity and verified backup/restore; (2) run migration 0026 and 0041 preflights, apply ordered migrations to isolated staging only with role/grant catalog assertions; (3) run private R2 derivative byte-integrity/rights and Stream TUS interruption/resume tests with non-production credentials; (4) record pass/fail artifacts; (5) then progress public Media and match-centre journeys. Owner-only decisions remain Entra configuration, private product host and VIP/prize legal disposition, and verified AdSense site Ready/seller record. Legacy source/backups, identity, paid/legal obligations and authored content remain preserved pending reviewed disposition.
- **Production boundary:** no production DNS, Workers/routes, databases, Supabase permissions/data/secrets, schedules, external Workers, Logic Apps, AdSense, merge or cutover performed in this checkpoint.


### 2026-11-11 M62 checkpoint — external editorial video is source-only

- Re-read issue #288, acceptance contract, execution plan, public page migration matrix and M62 handoff. Branch HEAD at audit start: `2d534fc00aacdda064071c4a41cc1b7d90f5672a` (M62 handoff). M62 implementation commits `69a4784d48c8fc6c873821fd57781ebeeaa7d3d2` and `c5ba6a08cd95fa592d710fc496a1bd598d5c79f5` add editor-controlled YouTube/Vimeo URL normalization, source/rights-reference entry and a parser regression test; they do **not** establish provider/browser, rights, editorial review or staging acceptance.
- Historical CI successes 42591208216 (isolated), 42591208379 (Vinext) and 42591208469 (protected staging) were rechecked; each job concluded success, but these are older M51 checks, **not** proof for M62 or the current branch HEAD. Current-head CI status must be checked before advancing any gate.
- **Newly explicit P0 blocker:** external video source registration and insertion into draft Markdown are two separate operations. Source metadata can persist while embed content remains unsaved; concurrent draft edits are not atomically protected. Existing manual Markdown can bypass the editor helper. Do not claim a rights-attested public-video workflow until server-side revision-scoped source/rights association, concurrency handling, historical provider compatibility and browser/player tests pass. Preserve approved YouTube/Vimeo, signed raw/HLS and Stream.io Goal Rush; do not enable paid Cloudflare Stream VOD.
- **Acceptance reconciliation:** P0 public media (homepage/news/match centre/ESPN-linked live/FD fallback/standings/tournaments/highlights), CMS/rights/identity and jobs; P1 private Predict/VIP/payments/prizes/settlement; P2 free predictions; and AdSense, SEO, accessibility, load, full match lifecycle, restore and rollback all remain OPEN without end-to-end runtime evidence. No compilation, parser test or protected health probe closes them.
- **Next safe bounded change:** implement a fail-closed server-side validator for external iframe references against revision-scoped editorial sources and rights metadata, with executable tests for malformed URLs, unreferenced embeds, historical exceptions and concurrency. Do not silently block existing published articles or change editorial legal policy. Then run current-head isolated/typecheck/Vinext CI and isolated staging browser tests. Azure migration/restore, Entra Media-host identity, private host, legal VIP/prize treatment and AdSense Ready/seller authorization remain blocked on independently verified resources/owner decisions.
- **Production boundary:** no production DNS, Workers, databases, Supabase, schedules, Stream billing, Logic Apps, AdSense, main merge or cutover was modified by this audit.


### 2026-11-12 M67 verification/CI trigger checkpoint — all runtime gates remain open

- Re-read tracking issue #288, acceptance contract, execution plan, public page/route/component and database-role matrices, M65–M67 handoffs and current V2 source. Compared M67 source-test commit `f4e4d257d081ce265fd2ed1b2327f0e4f77edf3c` against the branch: one subsequent M67 handoff-only commit was present before this checkpoint. No current-head passing CI was established: commit-associated workflow lookup for M67 returned no runs (this connector only returns PR-triggered workflows, so absence is **not** evidence that push CI did not run).
- **Bounded CI fix:** `beb282c26e2a6eeb51b8a5feb98b57ad2b6d91bd` adds `app/providers/**` to the isolated verification push paths. Previously, changes solely to `GlobalMediaProvider.tsx` did not match this workflow's provider path filter; the existing `test:engine` already includes `tests/*.test.cjs`, including the M67 structural lifecycle test. This change affects CI triggering only, not application behavior or any deployment. Its own CI result is not yet confirmed.
- **Source-only progress, NOT runtime acceptance:** M64–M66 introduced atomic external-video draft/source writes with locked revision identity, body and full-snapshot ETag comparisons; M67 added Stream.io ref-based disconnect, stale-session cancellation and single-flight host polling with source-regression assertions. Real two-editor PostgreSQL race tests, actual Stream.io join/switch/unmount tests, rights/provider/browser tests and current-head TypeScript/Vinext/protected staging evidence remain OPEN.
- **Acceptance reconciliation:** P0 homepage/news/CMS/public sports ESPN-linked live and conditional FD fallback, standings/match centre/highlights/video, R2/Stream.io, identity/roles, migrations 0004–0042, backup/restore, social/AI/Mail/jobs/retention; P1 private accounts/VIP/payment/prize/prediction/points/settlement/chat/MOTM; P2 anonymous free prediction; and release security/load/accessibility/PWA/SEO/AdSense/full match lifecycle/rollback are **OPEN** without appropriate staging evidence. Existing narrow PostgreSQL matches staging smoke evidence remains valid only for that read slice.
- **Next exact steps:** inspect push-triggered Actions for `beb282c`; execute current-head Node tests, TypeScript and Vinext; verify isolated Azure DB identity/backup and migrations 0026/0041 preflights before ordered staging-only migration; test two-editor video revision concurrency and actual Stream.io test-room lifecycle; then advance public media and full sports journeys. Owner-only decisions: Entra Media-host credentials, private Predict host/legal VIP-prize treatment and actual AdSense site Ready/seller record. No paid Cloudflare Stream VOD or AdSense activation.
- **Production boundary:** no production DNS, Workers, DB/Supabase, secrets, schedules, external rooms, Logic Apps, ads, main merge or cutover changed by this checkpoint.


### 2026-11-13 M67 follow-up — branch and CI evidence boundary; AdSense policy refresh

- **Fresh branch read:** `refactor/factsport-v2` HEAD is `421b489896b5290554fff6ec694887d0b65163a2` (the 2026-11-12 audit commit); no newer V2 source commit was observed at this checkpoint. Issue #288 remains OPEN. Re-read the acceptance contract, production plan, public page/route/component matrices and the isolated verification workflow; the latter includes `app/providers/**` and migration inventory 0001–0042.
- **CI truth:** GitHub commit-associated Actions lookup for current HEAD returned no PR-triggered runs; that API does **not** enumerate push-triggered runs. The current HEAD combined commit status reports a **failed Vercel** context, which is not a passing Factsport Cloudflare/Vinext acceptance signal and needs triage for relevance. Historical isolated run [42591208216](https://github.com/MketyDigital/Factsport/actions/runs/42591208216) is successful but belongs to earlier M51 code, not this HEAD. Therefore current-head engine/TypeScript/native Vinext/protected staging results remain **UNVERIFIED**. Do not infer CI failure or success for Cloudflare from the Vercel context.
- **Acceptance reconciliation:** P0 public homepage/news/editorial/CMS, ESPN-first live with conditional FD fallback, match centre/standings/tournaments/highlights, media rights/Stream.io, Azure migrations 0004–0042, Entra/RBAC, social/AI/Mail/jobs; P1 private Predict/VIP/payment/prize/settlement/chat/MOTM; P2 free prediction; and release security/backup/restore/load/accessibility/PWA/SEO/AdSense/full-match/rollback remain OPEN pending actual staging evidence. Existing protected `/matches` PostgreSQL smoke evidence is limited to that read slice. Source/structural tests for M64–M67 are not runtime SDK/database acceptance.
- **AdSense policy refresh (2026-11-13):** Google's [AdSense policy change log](https://support.google.com/adsense/answer/9336650) records a **22 October 2026** update to Video inventory restrictions clarifying accompanying-content and sticky-player rules; restricted video inventory can still receive fewer ads. Google's [Publisher Policies vs Restrictions](https://support.google.com/adsense/answer/10008391) distinguishes restricted inventory from policy violations and covers linked third-party content. The online-gambling publisher restriction and Nigeria eligibility concerns remain relevant; actual AdSense site Ready/Policy Center status, seller authorization, live robots/sitemap/ads.txt and public/private/legal/privacy reviews remain **BLOCKED/UNVERIFIED**, not approved. No ad loader activation.
- **Safe next work:** obtain direct push-triggered Actions evidence for this HEAD; run isolated Node, TypeScript, Vinext and protected staging checks. Confirm isolated Azure DB identity, backup/restore and migration 0026/0041 prerequisites before any stage-only schema/role work. Then real two-editor revision concurrency and non-production Stream.io room lifecycle tests. No new behavioral change is safe to mark verified without those resources; this checkpoint is audit-only.
- **Production boundary:** no production DNS, Worker/routes, PostgreSQL, Supabase, secrets, schedules, external Workers/rooms, paid Stream VOD, Logic Apps, AdSense, main merge or cutover was modified.


### 2026-11-14 coordination checkpoint — broader CI trigger coverage (no runtime acceptance)

- **Fresh branch baseline:** prior audit HEAD `400010547adbe4f806d69111470183b8c31332bf` matched `refactor/factsport-v2` (compare identical). Issue #288 OPEN. Re-read governing acceptance contract, roadmap, execution plan, page/route/component matrices and the isolated verification workflow. No newer application feature or staging evidence was found in the branch comparison.
- **Bounded reversible CI change:** `787643a` adds broad `app/**`, `workers/**`, `public/**`, `scripts/**`, `db/**` and `.github/workflows/**` push triggers to isolated verification. Previously edits limited to e.g. `app/match/[id]/page.tsx`, `app/live/**`, `app/layout.tsx`, public PWA icons/manifest or other uncovered paths could avoid the isolated workflow. Existing narrow filters remain for compatibility. `ad624788` adds a Node regression guard in `tests/v2-workflow-coverage.test.cjs` to prevent accidental removal of broad triggers. Intermediate test commits `586f205` and `2e2e39c` had assertion-escaping issues; corrected in `ad624788`. **Do not claim CI passing:** workflow runs for these commits are not confirmed; execute current-head tests/TypeScript/Vinext and protected staging before marking even the CI fix verified.
- **Acceptance reconciliation:** P0 public homepage/news/CMS, ESPN-first linked live with conditional FD fallback, match centre/standings/tournaments/highlights, rights/R2/Stream.io, Entra/RBAC, Azure migrations 0004–0042, social/AI/Mail/jobs; P1 private Predict/VIP/payment/prize/settlement/chat/MOTM; P2 free prediction; and full-match lifecycle, backup/restore, security, PWA/accessibility/load/SEO/AdSense/rollback all remain OPEN pending runtime-appropriate evidence. Protected PostgreSQL `/matches` smoke remains narrow historical evidence only.
- **Blocked prerequisites:** isolated Azure staging DB identity and restore evidence; migration 0026 and 0041 preflight and least-privilege grants; Entra Media-host sign-in; staging Stream.io room/provider credentials; private Predict host and legal VIP/prize disposition; actual AdSense site Ready/Policy Center and authorized seller confirmation. Google publisher restrictions and the 2026-10-22 video inventory update remain applicable; do not enable Google code or infer approval. Clean-data reset is generated operational/gameplay history only; preserve source backups, identity, paid obligations and authored assets for reviewed disposition.
- **Exact next actions:** (1) run Node tests including the new workflow guard, TypeScript, native Vinext and protected staging for latest HEAD; (2) confirm isolated DB identity, backup/restore and migrations 0026/0041 preflights before any staging migration; (3) run two-editor PostgreSQL video revision race, real non-production Stream.io lifecycle and full public media/sports journeys; (4) audit actual public crawl, legal/consent, ads.txt, sitemap, robots and Core Web Vitals before AdSense gate.
- **Production boundary:** no production DNS, Worker/routes, databases, Supabase, secrets, schedules, Logic Apps, external rooms, AdSense, main merge or cutover changed by this checkpoint.


### 2026-11-15 coordination checkpoint — current branch and CI evidence boundary

- **Verified repository baseline:** branch HEAD `ac5a75fb50650641840a313f4d61dc6001998ccd` at inspection; issue #288 remains OPEN. Re-read the acceptance contract, production execution plan, page migration matrix, latest issue comments, `.github/workflows/v2-verify.yml`, `tests/v2-workflow-coverage.test.cjs` and `package.json`. No newer source implementation is evidenced at this checkpoint.
- **CI source coverage:** workflow push filters now include `app/**`, `workers/**`, `public/**`, `scripts/**`, `db/**`, `.github/workflows/**` and `tests/**`; `npm run test:engine` expands to `node --test tests/*.test.cjs tests/*.test.mjs`, so the coverage regression test is included by the test command. This verifies configuration only, **not a successful Actions run**. The available commit workflow-run lookup is limited to PR-triggered runs and returned no runs; push-run results, TypeScript, Vinext and protected staging at current HEAD remain UNVERIFIED. Do not interpret absence of PR runs as no push run.
- **Acceptance reconciliation:** P0 public homepage/news/CMS, ESPN-first live with conditional FD fallback, match centre, standings/tournaments/highlights/video, R2/rights/Stream.io, Azure migrations 0004–0042, Entra/RBAC and social/AI/Mail/jobs; P1 private Predict/VIP/payment/prize/points/settlement/chat/MOTM; P2 free predictions; full match lifecycle, PWA, security, backup/restore, load, accessibility, SEO, AdSense, rollback and owner cutover authorization remain OPEN. Historical protected PostgreSQL matches read smoke is not parity evidence.
- **Highest-priority safe action:** obtain direct push-triggered GitHub Actions logs/current-head engine+typecheck+Vinext/protected-staging evidence; verify isolated staging database identity and backup/restore before any migration. Migration 0026/0041 attestation preflight and least-privilege writer grants must pass before staged writes; follow with two-editor revision race and real non-production Stream.io lifecycle tests. No staging credential, backup, runtime integration or owner authorization was established here, so no speculative application behavior change or migration was attempted.
- **Owner/policy blockers:** Media-host Entra login; private Predict host and VIP/prize legal disposition; AdSense account/site Ready, seller record, privacy/consent, public gambling-affiliate separation, crawlability and video inventory policy review. Do not enable ad code or paid Stream VOD. Preserve brand assets and clean-data reset exceptions for source backups, identity, financial/legal obligations and editorial assets.
- **Production boundary:** no production DNS, Workers/routes, PostgreSQL/Supabase, secrets, schedules, external services, Logic Apps, AdSense, main merge or cutover modified in this checkpoint.


### 2026-11-16 coordination checkpoint — fast-live source provenance and runtime evidence

- **Verified current repository HEAD:** `9236cd60b547db9ab4940c45cf9aba04e216ace4` at inspection; issue #288 remains OPEN. Re-read the governing acceptance contract, roadmap, production execution plan, page matrix, workflow/test coverage and new M69 source-locator handoff. This HEAD adds the M69 handoff; it is **not** proof of a working live-score/chat replacement.
- **Critical P0 parity distinction (M69):** legacy browser `app/utils/liveFetcher.ts`, `app/providers/MatchLiveProvider.tsx`, `app/components/FanZoneChat.tsx` and `app/components/MOTMVoteWidget.tsx` are present; complete deployed external ESPN fast/MOTM and D1 chat Worker entrypoints are **not** in the inspected current V2 tree. M68 `app/api/media/live-scores/route.ts` is a coarse PostgreSQL snapshot, **not** the 3-second ESPN live reader. Do not mark fast-live, chat or MOTM parity complete, nor treat legacy background `/api/live` as the fast reader. Recover original scripts via read-only authorized Cloudflare export or original upload before claiming byte-for-byte parity. Source-locator evidence: `docs/audit/handoffs/M69-LEGACY-FAST-LIVE-CHAT-WORKER-SOURCE-LOCATOR.md`.
- **CI evidence boundary:** current HEAD combined commit-status query returned no statuses; commit-associated workflow query returned no PR-triggered runs. These tools cannot prove push-triggered Actions outcomes. Thus current-head engine tests, TypeScript, native Vinext and protected staging are **UNVERIFIED**, not failed or passed. Historical protected `/matches` PostgreSQL smoke does not validate match-centre, fast live, chat or MOTM.
- **Reconciled gates:** P0 homepage/news/CMS, ESPN-first linked live/conditional FD fallback, match centre, standings, tournaments, highlights, rights/R2/video, Entra/admin/RBAC, migrations 0004–0042, social/AI/Mail/jobs remain OPEN; P1 Predict/VIP/payment/prize/points/settlement/chat/MOTM OPEN; P2 anonymous free predictions OPEN. PWA, accessibility, security, load, backup/restore, SEO/AdSense, full match lifecycle and rollback remain OPEN. No gate promoted from source presence or compilation.
- **Highest-priority next safe actions:** (1) obtain direct push Actions results or run engine/typecheck/Vinext/protected staging at this HEAD; (2) read-only recover deployed fast ESPN/MOTM and chat Worker sources and binding/configuration inventories without changing production; (3) verify isolated staging database identity, restore and migration 0026/0041 preflights before staging-only writes; (4) implement and exercise same-origin fast live, authenticated chat/MOTM and real match lifecycle with regression fixtures. Keep ESPN-first and conditional FD fallback; do not invent or relax business rules.
- **Owner/policy blockers:** isolated DB credentials/restore and writer grants, Media-host Entra, private Predict host and legal VIP/prize disposition, AdSense actual site Ready/authorized seller and policy/privacy/crawl verification. Google gambling affiliate and video inventory restrictions remain review gates; no ad code activation. Preserve existing logo/icons/palette and the generated-history-only reset exclusions for legacy sources/backups, identity, financial/legal records and authored editorial assets.
- **Change scope:** documentation-only evidence reconciliation, no behavioral source change because missing external deployed Worker source and runtime staging evidence prevent safe parity claims. No production DNS, Workers/routes, databases, Supabase, secrets, schedules, external rooms, Logic Apps, AdSense, main merge or cutover modified by this checkpoint.


## M76 — November 16 cache and deployment compatibility follow-up

- Vinext page ISR is now wired to Cloudflare Workers Cache through `workersCacheCdnAdapter()` and the typed Worker config helper. This uses Cloudflare's cache surface and adds no KV cache namespace.
- Removed the unused `/cdn/*` rewrite to Cloudinary after a tracked-source consumer scan found no usage. Vinext had warned that rewrite requests forwarded cookies and authorization headers to the external origin.
- Local verification: engine suite 275/275, TypeScript pass, Vinext build pass, cache/deploy-helper dry-run pass. Build output is `v1`; `cf deploy --prebuilt --mode production --dry-run` still requires `v0` and fails before upload.
- Latest exact-head Actions: isolated verification `43871889189` passed; protected staging `43871889138` failed at the intentional output-version guard before any Cloudflare deployment or HTTP probe.
- No DB migrations or production/staging resources changed. The Cloudflare output-version compatibility, migrations 0044–0048 acceptance, full Media/business parity, security/load/rollback and AdSense publisher readiness remain release blockers. See `docs/audit/handoffs/M76-CLOUDFLARE-CACHE-AND-DEPLOYMENT-COMPATIBILITY.md`.

## M77 — November 16 full V2 state reconciliation and release gate

- Re-read the current roadmap, production execution plan, migration/page/route/component matrices, AUTH-004/AUTH-005, and M44–M76 handoffs, including all explicit do-not-carry-forward constraints. M77 is the current summary; detailed feature evidence stays with each linked handoff.
- **Build/deploy tooling fix and narrow staging acceptance:** pinned `@cloudflare/vite-plugin` to `2.0.0-beta.v.17` and `cf` to `1.0.0-beta.32`. On commit `0980fc374168627a7e49e3bb113aca10f4602834`, isolated verification run `43888295007` and native Worker build run `43888295073` passed; protected app staging run `43888294900` passed. Staging deployed only the protected `factsport-v2-staging` Worker, passed unauthorized 404 checks for `/`, `/api/matches`, `/admin`, `/matches`, authorized DB+R2 health, PostgreSQL `/matches` first render, populated API response, keyset pagination, private/no-store, and auth/cache isolation. Local engine suite passed 275/275, clean-source TypeScript passed, Vinext build passed, and prebuilt CLI dry run exited before upload. This is narrow staging acceptance, not full product or production acceptance. Full deterministic lockfile, lint, browser suite, and end-to-end product acceptance remain open; no production resource changed.
- **Verified V2 slice:** historical isolated release evidence documents an Azure PostgreSQL `factsport_v2` staging database, restricted Cloudflare Hyperdrive roles, private R2, protected staging boundary and a narrow PostgreSQL-backed `/matches` page/API path. Existing ESPN/schedule workers, API boundaries, cache configuration, media/CMS/social/Stream source foundations, scoped anonymous prediction submission, ratings, and visual work are source-level or partial slices, not proof of current end-to-end product parity. Confirm the exact current staging migration/role/resource inventory before further writes.
- **Still open by product area:** public homepage/news/CMS/media and full route/component parity; full match centre and original fast ESPN/chat/MOTM Worker source/runtime parity; standings/tournament/highlights/PWA/accessibility; real Stream.io and social/AI/Mkety Mail journeys; editorial Entra admin sign-in and RBAC; customer Entra External ID accounts and identity migration; Prediction read/history/leaderboard/account claim, campaign/bonus, scoring/settlement/monthly audit/VIP/payment/entitlement; community chat/MOTM and ratings runtime; migrations 0044–0048 acceptance; jobs, provider reconciliation, failure recovery; SEO/consent/AdSense actual approval; dependency/security/abuse/load/backup restore; full match/account/paid-journey rehearsal, rollback and production cutover. Consult P0–P9 in the execution plan for the ordered gates.
- **Customer identity decision:** use Microsoft Entra External ID in a customer external tenant for the new user-account flow as requested. This is separate from workforce Entra and separate from the existing Media-editor OIDC adapter. The owner-subscription inventory now confirms the external tenant resource `factsports.onmicrosoft.com` exists in `external_group` (`unitedstates`). App registrations, client IDs, callback URLs, secrets, login flows, account mapping/recovery tests and staging acceptance are not yet verified. Keep the feature off until these are complete; do not silently link accounts by email.
- **Azure automation status:** Azure Logic Apps Consumption remains the intended optional orchestration layer only for approved external automation such as Buffer/Make distribution. The disabled workflow template/adapters are not a provisioned Logic App. Azure connection/APIM, managed identity or secrets, role/binding, provider credentials, private-destination E2E, cost/budget and replay/reconciliation are open. Keep direct Facebook/Telegram adapters direct.
- **Do not use on V2:** no workforce Entra tenant for customers; no legacy Supabase auth/session/mutations for new Media/Admin/Prediction; no active D1 or browser-to-external-Worker calls; no OpenNext, Cloudinary credential-forwarding rewrite, old unsafe monthly reset functions, `?key=` cron auth or browser-to-database access; no duplicated scheduler owners; no Azure Functions, Azure OpenAI, ACS Email, Redis, Service Bus, VM/AKS, Azure Blob or Cosmos, nor paid Logic Apps Standard unless a later approved architecture change explicitly selects them. Keep PostgreSQL/Hyperdrive and R2 boundaries, 3-second ESPN viewer behavior, anonymous Prediction consent/security rules, direct social adapters and free/approved Cloudflare surfaces. Do not activate AdSense until publisher/site/privacy/crawl approval is evidenced.
- **Release decision:** the current protected staging slice passed, but full product acceptance, production readiness, DNS change, legacy retirement and cutover are not complete. Production remains blocked until P0–P9 evidence is collected, owner-controlled Azure/Cloudflare resources are reconciled, full match/account/paid journeys and money/privacy obligations are accepted, restore/rollback is rehearsed, and explicit owner go/no-go is recorded.
- See `docs/audit/handoffs/M77-CURRENT-STATE-AND-CUTOVER-READINESS.md` for completed-vs-open detail and immediate next gates.


## M78 — Factsport TV specification integrated into V2 roadmap

- Read `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md` from the latest `refactor/factsport-v2` branch commit `c2fe0ab49dad81c3c4fd9c8be4b23e8f8a2805b6`. It is marked design approved in principle and implementation not started.
- Factsport TV is a modular subsystem inside V2, not a standalone product. One shared production engine will support Match Story first, then Factsport Daily, Weekend Football Review and Monday Team of the Week/Table Changes. The Match Story target is a data-backed, editor-overridable, 3–5 minute 3D-first video, using 2D where it gives more accurate/readable context.
- The supplied architecture proposes a read-only canonical sports snapshot, source/provenance/rights gates, human-reviewed narrative, an editable EpisodePlan, local/free-first render tooling (Blender + Three.js + FFmpeg subject to license review), private R2 storage, durable orchestration and approval-only publishing. These are design requirements, not selected or provisioned production services.
- Priority follows the owner's sequence: complete public Media and its eligible cutover first; complete Prediction/business migration next; only then begin Factsport TV implementation. TV is not a dependency or release blocker for the core Media or Prediction systems.
- TV production schedules, YouTube uploads, public integration, renderer credentials/resources, TV schema/workers and production publishing stay OFF. No TV code or migrations are claimed. Data-reuse rights, asset/player/voice/music licenses, renderer costs, model licensing and YouTube permissions remain open approval gates.
- V2 release sequencing is now explicitly phased: Media-only cutover may proceed after its complete P0/P3 plus shared security/restore acceptance if and only if route/domain mapping proves Prediction can remain isolated and unchanged; Prediction has its own later release gate; Factsport TV has a separate later launch approval. If Media and Prediction routes cannot be separated safely, do not cut over early.
- Implementation plan: `docs/implementation/TV-001-factsport-tv-engine.md`; detailed governing product spec: `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`; release gates: `docs/audit/PRODUCTION-EXECUTION-PLAN.md`; reconciliation: `docs/audit/handoffs/M78-FACTSPORT-TV-AND-PHASED-RELEASE.md`.


## M79 — Azure inventory reconciliation (owner Cloud Shell output)

- Read-only inventory confirms Microsoft Entra External ID directory resource `factsports.onmicrosoft.com` in `external_group` / `unitedstates`. The customer tenant exists; application registrations, redirect URIs, client configuration, runtime secrets, sign-in/recovery and OIDC acceptance remain unverified.
- PostgreSQL Flexible Server inventory confirms `mketypostgres` in `mkety_group`, West US, Ready, PostgreSQL 18, `Standard_B1ms`, 32 GiB, 7-day backups, with database `factsport_v2`. Do not create another server or run `infra/azure/bootstrap-staging.sh` with `APPLY=1`; that legacy script targets a new PG16 server. Reconcile and reuse the existing database only after confirming isolation, roles, migration ledger, network/TLS and restore posture.
- Logic App `la-factsport-v2-staging` exists in `rg-factsport-v2-staging` / `westus`, but is **Disabled** with a five-minute recurrence and only `NonMutatingDesignOnly`. The staging resource group lists no API connections; the subscription budget query lists none. This is a disabled design probe, not a provisioned social dispatch integration. Keep it disabled until approved identity, APIM/connection, credentials, budget, idempotency, delivery and monitoring gates pass.
- The earlier resource-name-filtered query was insufficient to detect PostgreSQL; its empty result is superseded by the full Flexible Server listing. The firewall listing returned `UNAVAILABLE` due to a malformed/pasted command, so firewall/TLS and role/migration/restore state remain open.
- No Azure resources were changed by these read-only commands. The bootstrap now refuses duplicate `factsport_v2` provisioning when `APPLY=1`. Next: inspect server networking and database config, verify Hyperdrive target and role grants without exposing credentials, then confirm migrations and restore status. No secrets or private rows should be copied into shared docs.

### M79 Azure network inspection — public endpoint and firewall drift

The owner's Cloud Shell screenshot shows the PostgreSQL server's `publicNetworkAccess` is `Enabled`, `subnetId` is null, and 15 IPv4 firewall rules are listed under `mketypostgres`. This is a public endpoint restricted by firewall allowlists, not private network integration. The database-detail command failed with `unrecognized arguments: --database-name factsport_v2`; metadata output was not obtained.

The listed rules align with Cloudflare IPv4 ranges except `factsport-cf-04`, shown as `104.16.0.0–104.31.255.255`. Cloudflare's current published ranges list `104.16.0.0/13` and `104.24.0.0/14` separately; `factsport-cf-04` therefore includes `104.28.0.0–104.31.255.255`, outside those published ranges. Record as firewall drift and verify the exact intended Hyperdrive/Cloudflare egress path before a carefully scoped rule correction. Do not make a live firewall change based only on the screenshot. Source: https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/.

No Azure network settings or firewall rules were changed. Next: re-run the database metadata command using the Cloud Shell CLI's accepted syntax; inspect the Hyperdrive target and TLS/role configuration without outputting secrets; then validate migration state and backup/restore.

### M79 Entra implementation and secret contract

Source review of `lib/auth/entra-external.ts` and `app/api/auth/entra/*` shows an implemented, host-restricted OIDC/PKCE sign-in path for the **Media editor/admin surface**. It requires `ENTRA_EXTERNAL_DISCOVERY_URL`, `ENTRA_EXTERNAL_ISSUER`, `ENTRA_EXTERNAL_CLIENT_ID`, `ENTRA_EXTERNAL_REDIRECT_URI`, and `FACTSPORT_AUTH_SESSION_SECRET` (base64url-encoded 32-byte key). The current code does not read or use `ENTRA_EXTERNAL_CLIENT_SECRET`; do not add one without a deliberate confidential-client code change. Callback sign-in only succeeds for an issuer/subject already linked in `public.external_identities`; it is not self-service account creation.

This is **not yet customer Entra sign-up/login or Prediction account auth**. Public customer identity, account linking/claim, recovery, registration, entitlements, and Prediction host flows remain unfinished. The staging deployment now accepts all five values as GitHub Actions secrets, validates them as an all-or-none set (HTTPS endpoints, exact callback path, canonical 32-byte session key), and includes them only in the staging Worker's secrets file. If none are set, Entra stays disabled. This is configuration plumbing only; sign-in still needs a real External ID user flow, a linked editorial identity, and staging end-to-end acceptance. The existing `DATABASE_URL` is a privileged PostgreSQL setup/migration credential and is unrelated to Entra registration. Keep it inside a reviewed, sanitized workflow; never paste or log its value. The app uses Cloudflare Hyperdrive for runtime DB access.


## 2026-11-17 M80 coordination — current-head reconciliation

- Inspected branch HEAD `79e7e19aaf584408e86eb9ba29767fd5814cce75` (`docs(auth): record staging secret handoff`); issue #288 remains OPEN. Compared 2026-11-16 audit `ba255c08` to current branch: 153 commits ahead, including recovered legacy ESPN/chat Worker source, same-origin ESPN-first media routes, PostgreSQL community migrations 0044–0048, tests, phased release/TV planning and M79 Azure/Entra handoff. This supersedes the prior blanket assertion that external Worker source was absent. The source archive is not proof of deployed runtime equivalence.
- M79 inventory confirms existing Azure PostgreSQL 18 server `mketypostgres`, database `factsport_v2`, existing External ID tenant `factsports.onmicrosoft.com`, and disabled design-only Logic App. Do not provision a duplicate server, enable Logic App or mutate production. Hyperdrive target, role grants, migration ledger, staging isolation, backup restore and Entra linked editorial-user sign-in still lack runtime acceptance.
- Latest HEAD combined status contains a **failed Vercel check**, which is not evidence of Cloudflare/Vinext CI failure. Commit-associated workflow query returned zero runs, but only exposes PR-triggered runs; current HEAD push Actions cannot be declared passed or failed from this result. Historical passing protected staging tests are limited to access isolation, DB/R2 health, matches and pagination.
- P0 public editorial/home/news/fixtures/live ESPN-first conditional FD fallback/match centre/standings/highlights/video/CMS/R2/media rights/admin/Entra/jobs: OPEN until staging journeys and a full match lifecycle. P1 private Predict/accounts/VIP/payments/prizes/settlement/chat/MOTM: OPEN. P2 free anonymous predictions: OPEN. PWA/AI/Mail/social, security, load, accessibility, SEO, AdSense, backups, rollback and owner approval: OPEN. Recovered source and source-level tests are not runtime sign-off.
- **BLOCKED:** migration 0026/0041 and newer 0044–0048 preflight against confirmed isolated staging DB, least-privilege role verification and restore drill; staging Entra issuer/subject mapping and callback/session tests; live ESPN/chat/MOTM parity; legal VIP/prize and AdSense Ready/publisher seller confirmation. Do not change live firewall despite recorded Cloudflare-range drift until egress is confirmed.
- **Next safe action:** obtain direct push-triggered current-head Actions logs; inspect protected staging DB/Hyperdrive target and migration ledger without exposing credentials; verify backup/restore; only then apply reviewed migrations to isolated staging and execute live-match/editorial/identity integration tests. No production, DNS, Workers, database, Supabase, secrets, schedules, AdSense, Logic Apps or main-branch changes authorized.


### M81 — Staging Entra browser path and DB preflight (2026-11-17)

- Owner confirmed the Entra External ID user flow is already attached to the `Factsportv2` application and the five Media OIDC/session GitHub secrets are present. This does not finish customer Entra or Prediction account identity.
- The staging Worker now allows the Media sign-in page and exact OIDC start/callback/logout routes without Cloudflare Access. A `/admin/*` request can pass the staging transport gate only when the Media session cookie is present; the admin layout/actions still decrypt the session and re-check the linked issuer/subject, active Media role, and editorial database membership. Other staging pages and APIs remain denied unless they carry the temporary CI token. No production route/DNS change was made.
- The staging code still lacks a dedicated `FACTSPORT_EDITORIAL_HYPERDRIVE` binding in `cloudflare.config.ts`. This is a separate least-privilege connection/role to the existing `factsport_v2` database, not a second database. The Media sign-in page remains unavailable until ordered editorial migrations, required grants/role, and the dedicated binding are validated. The callback also rejects an Entra issuer/subject that is not pre-linked to an existing internal user.
- Added `.github/workflows/v2-app-staging.yml` checks for unauthenticated browser access to the Media login page and Entra start endpoint while preserving denial checks on public staging routes. Source commits: `bb0f8ac`, `88938c7`, `472a863`, `5c9834e`. Direct user-flow callback completion has not yet been proven.
- The initial direct GitHub-runner DB preflight (`92d46ac`, run `44161479046`) failed with `CONNECT_TIMEOUT`; the repository secret was present, but the hosted runner could not reach Azure PostgreSQL. No SQL writes occurred. That direct workflow was removed. The read-only inventory now runs through `/api/v2/staging/db-preflight` over the already-bound staging Hyperdrive, and its JSON summary is included in the existing one-click `v2-app-staging.yml` run. The endpoint requires the short-lived CI header, only reports sanitized database/TLS/table/role metadata, and always returns 404 outside staging. The new integrated workflow result is still pending.
- Cloudflare Access was not enabled or configured. No database, firewall, Azure Logic App, production Worker, production DNS, or production data was changed.
- **Still open:** Actions result for the newest staging/browser and read-only DB preflight workflows; actual editor DB role/binding/migration state; linked Media editor identity and successful end-to-end callback; all other Media runtime/browser/provider acceptance; customer Entra/Prediction; Prediction and cutover gates. Do not treat this incremental login transport work as a staging sign-in pass or production readiness.


### 2026-11-18 coordination checkpoint — CI visibility and runtime evidence

- Read issue #288 and its latest 2026-11-17 checkpoint, governing V2 acceptance contract, execution plan, page migration matrix, current branch roadmap, and recent repository commits. The most recent repository commit returned by commit search was `6987974b15736ba2e3d9e338346623b84ee06940` (public homepage announcements); this search is repository-wide and **does not independently establish the branch HEAD**. Verify branch-specific HEAD before declaring a current-head pass or applying changes.
- Commit `6987974b` has a **Vercel failure** with a build-rate-limit URL, not proof of a Cloudflare/Vinext failure. The GitHub workflow-run connector returns PR-triggered runs only; zero returned runs **cannot** establish that push-triggered isolated verification, native Vinext or protected staging passed or failed. No new passing current-head Actions evidence was established today.
- The source contract and page matrix retain OPEN acceptance for public home/news/fixtures/ESPN-first 3-second linked live with conditional FD fallback/match centre/standings/tournaments/highlights/video; CMS/R2/rights; accounts/Entra/admin; private Predict/VIP/payment/prizes/points/settlement/monthly audit; chat/MOTM/match pins; PWA; AI/Mail/social/indexing and all schedules/retention jobs. Recent source commits and protected health/read smoke tests are **not** end-to-end or match-lifecycle acceptance.
- M79 Azure inventory identifies `mketypostgres` / `factsport_v2` and External ID tenant `factsports.onmicrosoft.com`, but **staging isolation, Hyperdrive target, database migration ledger/roles, restore drill, migration 0026/0041/0044–0048 preflights and complete Entra login** remain unverified. Do not run staging migrations without isolated DB identity and recoverable backup proof.
- AdSense remains a release gate: actual Google site Ready status/seller record, legal VIP/prize and affiliate treatment, public/private separation, consent/privacy, original content, live robots/sitemap/ads.txt, mobile/accessibility/Core Web Vitals and placements remain unverified. No ad code authorization. Preserve logo/icons, navy/red/neutral palette, Lucide icons and the clean operational-data-only reset rule.
- **Next exact safe actions:** (1) independently establish branch HEAD and inspect push Actions via GitHub Actions UI/API; (2) obtain sanitized read-only staging DB/Hyperdrive identity, migration ledger, least-privilege grants and restore evidence; (3) preflight migrations without applying them; (4) execute real staging editorial, ESPN/chat/MOTM, auth and full match lifecycle journeys; (5) reconcile every route/job and owner policy decision before release sign-off.
- **BLOCKED / no behavioral change:** without branch-specific CI and staging DB/restore evidence, no speculative implementation or migration is justified. No production DNS, Workers/routes, database/Supabase, secrets, schedules, external Workers, Logic Apps, AdSense, main merge or cutover action was performed in this checkpoint.


### 2026-11-18 update — protected staging run completed; release gates remain open

- Latest one-click staging workflow [44344593040](https://github.com/MketyDigital/Factsport/actions/runs/44344593040) passed on the refactor/factsport-v2 branch (3f9200d9b8f347c87d17b1ab155b41db148f28d2). It verified build/typecheck/regression, token-gated staging, Entra authorization start/PKCE, Hyperdrive TLS to factsport_v2, R2 health, the PostgreSQL /matches page/API, pagination and cache/auth isolation.
- This is staging acceptance for a narrow match-read slice, not full Media parity or production readiness. Read-only DB inventory found external_identities but no media_editorial_memberships, no migration tracking table and no checked editorial/prediction/broadcast runtime roles. Actual applied migration history and restore evidence are still unverified.
- Media editor authorization, customer Entra flows, Prediction reads/settlement/VIP/payment, complete match-centre/ESPN/chat/MOTM parity, real provider delivery, Azure Logic Apps execution, PWA/security/load/SEO/AdSense and P9 release rehearsal remain open.
- Next: complete a read-only admin catalog audit and backup/restore verification before schema writes; then provision dedicated Media roles/binding and apply only reviewed ordered migrations. Keep all feature flags and Logic Apps disabled until acceptance passes.
- M78 phased order remains binding: Media-only cutover first only if routes are separable and P0/P3/P4/P8 acceptance passes; Prediction receives a separate later release; Factsport TV begins at P10 only after Media and Prediction stabilize. No production routes, DNS, Supabase, Azure database, scheduled jobs or Logic App were changed by run 44344593040.


### 2026-11-18 follow-up — corrected runtime role inventory

The latest staging run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) passed on attempt 2 after a transient 404 on the first attempt. The read-only inventory list was aligned with the current migration-verification role names. It confirms the existing roles factsport_v2_reader, factsport_v2_schedule_writer, and factsport_v2_espn_writer; each reports superuser=false, canCreateRoles=false, and canCreateDatabases=false. It reports these planned roles as absent: factsport_v2_editorial_writer, factsport_v2_media_automation_writer, factsport_v2_social_dispatcher, factsport_v2_media_broadcast_admin, factsport_v2_broadcast_token_issuer, factsport_v2_media_access_admin, and factsport_v2_prediction_api. public.external_identities exists; public.media_editorial_memberships does not. No migration tracking table was discovered. This still does not determine the complete applied schema history or backup/restore recoverability.

This successful retry re-verifies the narrow staging match-read and Entra-start paths only. Do not create missing roles or apply migrations until the admin-side read-only catalog/restore audit and reviewed migration plan are complete. No production resources or data were changed.


### 2026-11-18 admin-audit attempt — no database query performed

A follow-up read-only catalog audit was attempted with the existing temporary audit Worker workflow [44347722061](https://github.com/MketyDigital/Factsport/actions/runs/44347722061). Typecheck passed, but Cloudflare rejected deployment because the temporary Worker factsport-v2-db-role-audit did not exist in the account (API code 10007). The job failed before installing its audit token or opening the admin Hyperdrive; no database query, role change, schema write, or production change occurred. This leaves admin-side grant/migration audit and backup/restore evidence open. The application-worker read-only inventory from run [44346109481](https://github.com/MketyDigital/Factsport/actions/runs/44346109481) remains valid for current database identity, TLS, table presence, and expected-role existence only.


### 2026-11-18 follow-up — admin role audit evidence

The read-only PostgreSQL catalog audit passed in [run 44350082264](https://github.com/MketyDigital/Factsport/actions/runs/44350082264) after pinning the temporary audit workflow to Wrangler 4.158.0, the version used by its prior successful deployment. The temporary audit Worker was removed. The audit confirmed database owner `mketydbadmin`; only `factsport_v2_reader`, `factsport_v2_schedule_writer`, and `factsport_v2_espn_writer` were present among the roles it inspects. All three have no superuser, role/database creation, replication, RLS bypass, inherited-role, or membership rights; no public function/sequence privileges; no public-schema object creation or temp-table rights. Reader has SELECT on `matches` only; schedule and ESPN roles have the observed limited match-column writes. No database writes occurred.

This closes the first admin-side least-privilege catalog check for these three runtime roles, not the full migration/schema ledger or backup/restore gate. Planned Media/editorial/broadcast and Prediction roles remain absent according to the successful app inventory. Next: prove backup/restore recoverability, inspect actual schema/migration state, then apply only reviewed staging migrations and provision the required narrow roles/bindings. Do not enable production or change release ordering.

### 2026-11-18 follow-up — current schema inventory

The extended read-only admin audit passed in [run 44350763779](https://github.com/MketyDigital/Factsport/actions/runs/44350763779); isolated verification passed in [run 44350763506](https://github.com/MketyDigital/Factsport/actions/runs/44350763506). It confirms exactly four public relations in `factsport_v2`: tables `app_users`, `external_identities`, `job_runs`, and `matches`. No migration-ledger-like relation was found, and only the three runtime roles covered in the preceding audit exist. No SQL writes occurred. Current DB contents therefore do not yet include the later Media/editorial, broadcast, community, or Prediction schemas. Preserve the migration-order and clean-reset policy; do not infer a complete ledger from object presence or replay migrations blindly. Next gate is backup/restore rehearsal before a reviewed ordered migration plan on a recoverable staging copy.

### Owner clarification — fresh V2 database

No legacy database restore or import is part of the V2 clean-reset plan. `factsport_v2` is the V2 target; the intended operational/gameplay state starts fresh, while new V2 fixture rows already present are preserved. Continue by applying the reviewed ordered schema migrations to this target. The production plan's backup/PITR requirement is a recovery-resilience gate for the V2 target before production release, not a source-data restore gate and not a reason to pause implementation. No production resources or legacy data are to be changed.

### 2026-11-18 — fresh V2 schema chain applied

The guarded staging migration workflow [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) completed successfully against the verified Azure PostgreSQL target `factsport_v2`, connecting as the administrative migration identity `mketydbadmin` through the exact V2 Hyperdrive. It applied all 49 ordered migrations, versions 0000–0048, and verified a contiguous SHA-256 migration ledger. No legacy operational data was restored or imported; the V2 clean-start target and existing V2 fixtures remain the intended source of truth.

This closes the applied-schema step for the V2 migration chain. It does not prove all Media/runtime roles and credentials are provisioned, create runtime Hyperdrive bindings/logins, complete the real Entra editor journey, complete Media/provider acceptance, enable the disabled Azure Logic App, or establish backup/PITR recovery. Production remains no-go. Continue with a separate read-only schema/role/ledger audit, then finish Media runtime provisioning and acceptance, recovery rehearsal, route isolation and P9A rollback/go-no-go before any Media cutover. Prediction remains P9B; Factsport TV remains P10 after Media and Prediction are stable.


### 2026-11-18 — clean-start schema applied and audited

The Azure target `factsport_v2` now has the full ordered V2 migration chain (0000–0048, 49 entries) applied by [run 44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095). Independent read-only catalog audit [44360257808](https://github.com/MketyDigital/Factsport/actions/runs/44360257808) confirms a complete checksummed ledger, 80 public relations, 11 NOLOGIN capability roles, no memberships, no schema CREATE/TEMP rights, and expected isolated community/Prediction function grants. No legacy database restore/import was performed.

Next: provision only the reviewed Media LOGIN identities and dedicated Hyperdrive bindings, finish Media Entra/provider/Logic Apps acceptance and P9A rollback/release gates. Prediction schema is present but its app flow/cutover is separately gated at P9B. Factsport TV remains P10, after Media and Prediction are stable. Production remains unchanged and no-go.


### 2026-11-18 follow-up — Media editorial runtime provisioned

The staging-only editorial LOGIN and dedicated Hyperdrive are now provisioned and bound to the V2 staging Worker: bootstrap [44362059881](https://github.com/MketyDigital/Factsport/actions/runs/44362059881) and app deploy [44362390781](https://github.com/MketyDigital/Factsport/actions/runs/44362390781) succeeded. This supersedes the immediately preceding next-step note that all Media LOGIN identities/bindings were still to be provisioned. It does not close Entra editor acceptance, other Media runtime/provider integrations, Logic Apps operational acceptance, V2-target recovery rehearsal, browser acceptance, route isolation, rollback or P9A. No legacy DB restore/import is planned or needed; the P1 recovery rehearsal concerns the V2 target only. See M77 for exact evidence and open gates.


### 2026-11-18 follow-up — staging Media sign-in readiness passes

A false-negative Media login readiness check was fixed: the dedicated runtime connects as `factsport_v2_editorial_app` and inherits the NOLOGIN `factsport_v2_editorial_writer` capability role. The app now checks the actual login plus effective role membership and scoped grants. Updated staging smoke verifies the login page renders “Continue with Microsoft,” as well as the Entra authorization redirect/PKCE contract. Run [44367785398](https://github.com/MketyDigital/Factsport/actions/runs/44367785398) passed. Interactive Entra callback, linked editor membership and protected authoring acceptance remain open; no legacy restore/import or production cutover is required for this fix.


### 2026-11-18 owner preference — Factsport-branded identity journey

Owner preference is a Factsport-only customer-facing identity experience. Keep Entra External ID as the current managed identity backend for now; do not expose Microsoft naming in Factsport-owned UI. The Media login button now says “Sign in to Factsport” and staging asserts the Factsport label. Next tenant-side steps are to set the display name to Factsport, apply External ID company branding, configure a Factsport custom login domain, and grant tenant-wide admin consent to the minimum app permissions so customer users do not encounter the first-party Microsoft consent prompt. Microsoft’s consent surface cannot be reskinned; tenant-wide admin consent is the way to remove it from the routine customer journey. The default verification email can show the configured tenant name; a fully Factsport-branded OTP email requires the custom OTP send extension and a verified sender through an approved mail provider (assess the existing Mkety Mail/Logic Apps adapters before enabling). The `Continue with Microsoft` source regression assertion was updated to enforce Factsport-owned wording.


### 2026-11-19 checkpoint — migration and editorial staging evidence reconciled

- Compared V2 branch against 2026-11-18 audit commit `2884c0c`: **79 commits ahead, zero behind** at inspection. Branch-specific compare establishes advancement, but does not itself identify the exact current HEAD SHA. Do not treat repository-wide commit search as a branch-head lookup.
- Supersede prior four-table/no-ledger and all-editorial-roles-absent statements: guarded Azure staging apply [44358887095](https://github.com/MketyDigital/Factsport/actions/runs/44358887095) installed migrations 0000–0048; independent read-only audit [44360257808](https://github.com/MketyDigital/Factsport/actions/runs/44360257808) reported 49 checksum-valid ledger entries, 80 public relations and 11 restricted NOLOGIN capability roles. This is applied-schema evidence, **not** feature acceptance.
- Editorial staging LOGIN and dedicated Hyperdrive were provisioned [44362059881](https://github.com/MketyDigital/Factsport/actions/runs/44362059881); staging Worker passed [44362390781](https://github.com/MketyDigital/Factsport/actions/runs/44362390781). Corrected readiness and Entra-start/PKCE smoke passed [44367785398](https://github.com/MketyDigital/Factsport/actions/runs/44367785398). Actual interactive editor callback, exact issuer/subject mapping, active membership, protected authoring/publishing and logout remain OPEN.
- Current-head push-triggered CI remains **UNVERIFIED** through the available connector: its commit-workflow lookup only includes PR-triggered runs and returned none for inspected repository-wide commit `fd07a1dc`. Do not infer a pass or failure. Obtain direct Actions run and exact head_sha evidence.
- Acceptance groups still OPEN: full public Media/news/CMS and rights, ESPN-first linked 3-second live and conditional FD fallback, match centre/standings, chat/MOTM, private Predict/VIP/payments/prizes/settlement, PWA, AI/Mail/social/indexing/jobs, accessibility/security/load/SEO, AdSense Ready and legal review, V2 backup/PITR/rollback, full match lifecycle and owner P9A/P9B go/no-go. Factsport TV remains deferred P10.
- Next bounded safe actions: verify branch-specific HEAD and CI; perform owner-authorized isolated staging editor Entra end-to-end journey; complete least-privilege runtime integration and V2 recovery rehearsal; run public Media and sports lifecycle staging acceptance. Do not change identity rules or provision extra production services speculatively.
- No production changes, no AdSense code activation, no main merge or cutover in this checkpoint. Preserve the clean V2 operational reset and all legacy backups/paid/editorial obligations.


## 2026-11-20 coordination checkpoint — branch-specific CI and release gates

- **Exact inspected V2 HEAD:** `72ec762de2d3aaedd49b548271906dfd1fff900d` (2026-11-20 08:34:33 UTC; article share-card staging evidence). Branch-specific GitHub REST read confirms this is `refactor/factsport-v2`, not a repository-wide commit-search guess.
- **Direct push Actions evidence:** isolated verification [44703641851](https://github.com/MketyDigital/Factsport/actions/runs/44703641851) **passed on that exact HEAD**. On parent `8b29c752d`, isolated verification [44703313261](https://github.com/MketyDigital/Factsport/actions/runs/44703313261) and protected staging/read-only database preflight [44703313309](https://github.com/MketyDigital/Factsport/actions/runs/44703313309) passed. On earlier `aef7cdb50`, isolated [44702832685](https://github.com/MketyDigital/Factsport/actions/runs/44702832685), native Vinext build [44702832677](https://github.com/MketyDigital/Factsport/actions/runs/44702832677) and staging preflight [44702832404](https://github.com/MketyDigital/Factsport/actions/runs/44702832404) passed. **Do not imply native build or protected staging passed on exact latest HEAD without their own matching SHA evidence.** Earlier failed runs at `7f5a370dd` are superseded for source verification by the later passing `aef7cdb50` trio, not by complete end-to-end parity.
- **Database:** preserve 2026-11-19 evidence for guarded 0000–0048 migrations, checksums, 80 relations and 11 restricted capability roles. The migration ledger and restricted role audit are narrower than actual restore/PITR, complete editor login or private-business acceptance.
- **Matrix reconciliation:** public home/news/highlights/matches/live/standings/tournaments/match centre and 3-second ESPN-first feed with approved conditional FD fallback: OPEN for complete browser/provider/lifecycle parity; CMS/R2/media rights/social: OPEN for authenticated publish/rollback; Entra identity/admin: OPEN for interactive callback, issuer+subject authorization and logout; Predict/VIP/payment/prize/points/settlement/monthly audit: OPEN, owner/legal decisions BLOCKED; chat/MOTM/pins/video/PWA/AI/Mail/indexing/schedules/retention: OPEN for live integration and operations evidence; security/backup/restore/rollback/load/accessibility/SEO/AdSense: OPEN. Existing logo, favicon, app icons, navy/red/neutral palette and Lucide language remain protected. No source-only evidence is promoted to runtime parity.
- **Highest-priority safe next action:** run an authorized, isolated staging editor Entra login → issuer/subject membership → draft/review/publish → public canonical/share-card → unpublish/logout journey with negative RBAC tests, redacted logs and rollback evidence; then backup/PITR rehearsal and full ESPN-linked match lifecycle. Do not enable ads or alter private financial/prize mechanics without owner decision. P9A Media, P9B Prediction and later P10 TV remain separate gates.
- **AdSense:** site/account Ready and seller ownership remain owner-verification BLOCKED; check current Google Publisher Policies/Restrictions, affiliate/sportsbook and VIP/prize legal treatment, editorial rights, robots/sitemap, ads.txt, navigation/disclosures, mobile/CWV and placements before any activation. No Google ad code enabled.
- **Safety:** this checkpoint is documentation only on V2 branch; no production DNS/Workers/DB/Supabase/secrets/schedules/Logic Apps/AdSense, no main merge or cutover. No behavioral patch was justified without an authenticated staging journey and owner policy decisions.


## M82 — Entra callback filter and release reposition (2026-11-21)

- Re-read governing roadmap, production execution plan, M77 current-state handoff, M74 Media visual acceptance, M78 phased-release handoff, TV-001 checklist and the Factsport TV product spec. The release order is unchanged: Media P9A if route isolation and its gates pass; Prediction/business P9B separately; TV P10 only after both. The existing `factsport_v2` is the clean-start DB; no legacy DB restore/import. Do not enable the disabled design-only Logic App.
- Updated middleware so the exact `GET /api/auth/entra/callback` route bypasses only the legacy generic path/query heuristic. OIDC callback host, state-cookie/parameter bounds, encrypted state, state equality, PKCE, issuer/audience/signature/nonce and exact issuer+subject editorial mapping remain enforced. Other request paths retain the threat filter.
- Updated the staging workflow with a fail-closed callback probe using opaque encoded query values and no state cookie. Expected behavior is the generic login-error redirect from the callback handler, demonstrating middleware handoff without accepting a session.
- Source commits: `0b80277` (middleware) and `bf0d41f` (staging smoke); handoff: [M82](./handoffs/M82-ENTRA-CALLBACK-THREAT-BOUNDARY.md).
- **Verification pending:** the changes are eligible for the branch push-triggered and manual staging workflow. Do not call the new smoke or updated staging deploy passing until a run with exact source `head_sha` is checked. The screenshot alone does not prove whether the observed 403 came from a stale Worker, another request shape or an upstream layer.
- Next: verify isolated build and protected staging at the changed source SHA; retry the real External ID browser login; then complete exact issuer/subject linkage, active editorial membership, denial cases, draft/review/publish, public canonical/share-card, unpublish and logout. Continue remaining M74 page/share/mobile/accessibility/rights gates, V2 backup/PITR restore and full sports lifecycle before P9A route isolation/go-no-go. P9B, P10, production cutover and legacy retirement remain separate and open.
- No production DNS/routes/Worker/database/secrets/jobs/Logic Apps/AdSense or legacy services were changed. No release gate is closed by this middleware adjustment.


## M83 — Match result and lineup share cards (2026-11-21)

- M74-D implementation now includes a text-only full-time result card and a text-only starting-XI card. The result renderer requires two nonnegative integer scores. The lineup renderer requires eleven named starters per side. Incomplete inputs produce neutral unavailable cards; neither template invents values or fetches remote crests/player images.
- Finished-match metadata selects the result card only when both canonical scores are valid. Upcoming-match metadata selects the lineup card only when both starting elevens are complete. Live/incomplete match metadata preserves the existing versus card.
- Removed the “Predictions” phrase from the public match-page title metadata; this does not yet prove complete Media/Prediction route separation or complete private Prediction product behavior.
- Source commits: `5663872` (renderers), `ab90b16` (metadata), `5755f2f` (long-label bounds), `5429f86` (staging PNG smoke), `8803c41` (PNG signature and 1200×630 dimension checks); handoff: [M83](./handoffs/M83-MATCH-SHARE-CARDS.md).
- **Exact-head verification pending.** The staging workflow now requires non-empty PNGs for the result and lineup templates and verifies PNG signatures and 1200×630 dimensions for the article, result and lineup cards. Wait for matching-head isolated build and protected staging evidence before marking runtime acceptance complete. PNG generation does not satisfy visual, crawler, rights, mobile or accessibility acceptance.
- Next: inspect actual generated cards and route metadata; complete authenticated editor publish/unpublish, public Media/M74-A/B/C/D responsiveness/accessibility/crawler/rights acceptance, ESPN-linked match lifecycle, recovery/rollback and P9A route isolation/go-no-go. Prediction P9B and Factsport TV P10 remain later phases.
- No production DNS/routes/Worker/database/secrets/jobs/Logic Apps/AdSense changed. No release gate closed by source-only renderer work.

## M84 — Public Media/Prediction surface isolation (2026-11-21)

- Removed Prediction and bookmaker actions from public match rows/cards, the public match detail, and the public match-center tab; changed the homepage `/matches` shortcut label from “Predict” to “Matches”. Public Media now renders sourced match/status content only in these locations.
- Prediction schemas, APIs, components and feature configuration remain for the separate private product/P9B. Stripped the predictor model from public match-detail serialization and the public same-origin live API (including cached and DB-fallback responses). No gameplay/account/financial data or backend state was changed.
- Added an exact staging route assertion that reads a real fixture’s public match detail and fails if the `/matches` list or `/match/{id}` HTML exposes Prediction or bookmaker UI; an enabled public live API must also omit the `predictor` field. Source commits: `1e98214`, `45a6457`, `1cf686b`, `bc5bd6b`, `a123041`, `ed5b69f`, `96fbd94`, `219c102`, `c11bbba`, `10eba92`, `6e34c90`, `5e081cd`; handoff: [M84](./handoffs/M84-PUBLIC-MEDIA-PREDICTION-ISOLATION.md).
- **Exact-head build/staging result pending.** The assertion does not yet cover every public page, feed, manifest, metadata or browser journey. Scan all P0 public routes and metadata before P9A. Do not mark public/private isolation complete on these component changes alone.
- No production routes, Worker, database, secrets, jobs, Logic Apps, AdSense or legacy systems changed. P9A remains open; P9B is preserved as later private-product work; P10 TV follows Media and Prediction.


### 2026-11-21 — M85 CI regression triage (branch-specific, direct Actions evidence)
- **Inspected V2 HEAD:** `34b745747f5d0256412475350a9a7cafb36da283` (`docs: keep M84 live projection reference current`); this is the actual `refs/heads/refactor/factsport-v2` target, not a repository-wide latest-commit search.
- **Current-head CI FAIL:** [isolated verification 44870017325](https://github.com/MketyDigital/Factsport/actions/runs/44870017325), push event 2026-11-21 05:15 UTC, failed at `Run existing engine regression suite`: **276 tests, 272 pass, 4 fail**. The [native Vinext 44869967178](https://github.com/MketyDigital/Factsport/actions/runs/44869967178) and [protected staging 44869967193](https://github.com/MketyDigital/Factsport/actions/runs/44869967193) for earlier `96fbd943` also failed at their engine regression steps; these runs do **not** prove build or staging runtime failure.
- **Four failing assertions:** `tests/adsense-readiness.test.cjs` expects development-only `PredictionBoard` gating; `tests/entra-media-login.test.cjs` expects validated Entra callback exception to opaque-query signature filtering; `tests/media-fast-espn-no-d1.test.mjs` expects live/finished score projection expression; `tests/prediction-submission-api.test.cjs` expects the public submission readiness/open gate. All point to the match page / middleware changes; determine whether the source regressed or test expectations are stale before altering either. **Do not relax security, paid eligibility or prediction rules merely to green CI.**
- **Acceptance impact:** current-head source checks are red; ESPN-first fast feed, match-centre/public prediction, Entra callback safety and AdSense-safe interaction separation cannot be accepted. The previous 49-migration/80-relation/11-role staging evidence is historical and narrower than full runtime parity; no new backup/restore, full editor journey, complete match lifecycle, accessibility/load/SEO/AdSense readiness or owner go/no-go evidence was obtained.
- **Next exact actions:** inspect diffs around `app/match/[id]/page.tsx`, Entra callback/middleware and the four tests; reproduce `npm run test:engine` in isolated CI; make one behavior-preserving correction with targeted regression coverage; rerun isolated verification, native Vinext and protected staging at the **same new SHA**. Then continue real Entra editor publish/unpublish/logout, PITR/restore and ESPN/chat/MOTM match lifecycle.
- **Owner BLOCKED:** independent VIP/prize/payment/identity/editorial disposition and sportsbook affiliate/legal/AdSense eligibility decisions; no ad loader until owner verifies actual site/account Ready. Preserve existing Factsport identity and all production resources. No production changes, deployment, merge or cutover authorized.

### 2026-11-21 — M86 newsroom Media boundary and regression follow-up
- Corrected the newsroom Explore Factsport shortcut from “Predictions” to “Matches”; its destination was already the public `/matches` route. Added visible keyboard focus styling.
- Removed all three remote decorative texture fetches from the newsroom hero and `NewsArtwork`, replacing them with inline CSS patterns; decorative artwork is hidden from assistive tech and pulse motion respects reduced-motion settings. Final hero commit: `97c7edc`.
- Preserved known finished scores in the fallback match share card (`f1645b6`).
- Reconciled four stale regression assertions against the selected M84 behavior: no Prediction submit UI on public Media match detail; exact Entra callback exception assertion; the valid fallback finished-score projection. Commits: `4b084bc`, `c398d19`, `c9bfa9f`.
- Source commits: `f0a3b62`, `9add1bd`, `97c7edc`; newsroom regression check: `9e4f334`; handoff: `docs/audit/handoffs/M84-PUBLIC-MEDIA-PREDICTION-ISOLATION.md`.
- Previous exact-head engine suite failed at `34b7457`. Corrections are pushed; Vercel was pending at `c9bfa9f`, and no matching Actions result was available during this update. M84 route-wide scan, exact-head CI, Media browser/accessibility acceptance, M74 completion and P9A gates remain open. No production resource or route changed.
