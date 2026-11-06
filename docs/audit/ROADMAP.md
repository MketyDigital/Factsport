# Factsport modernization — master roadmap
Status: M0 discovery in progress | Repository: MketyDigital/Factsport | Branch: refactor/factsport-v2
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
