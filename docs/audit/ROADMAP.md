Warning: truncated output (original token count: 35441)
Total output lines: 766

Warning: truncated output (original token count: 29058)
Total output lines: 728

# Factsport modernization — master roadmap
Status: V2 refactor active; full clean-start database migration chain applied to factsport_v2 on 2026-11-18; broader Media/Prediction acceptance and production remain open | Repository: MketyDigital/Factsport | Branch: refactor/factsport-v2
Updated: 2026-11-21

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
- [ ] **M74-A match center:** enhance scoreboard hero/competition and match status presentation, 2D pitch positioning/responsive bench, event timeline, momentum only where source data is independently available, and stat comparisons; preserve live polling, clock semantics, Stream.io, chat and MOTM. Prediction entry/account actions remain on the separate Prediction surface under M84/P9B and are not a Media match tab.
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
- Facebook and Telegram MUST remain direct API integrations. Third-party marketing automation MAY use Azure Logic Apps adapter; Cloudflare Workflows counterpart rem…25441 tokens truncated…cated editor publish/unpublish, public Media/M74-A/B/C/D responsiveness/accessibility/crawler/rights acceptance, ESPN-linked match lifecycle, recovery/rollback and P9A route isolation/go-no-go. Prediction P9B and Factsport TV P10 remain later phases.
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
- Source commits: `f0a3b62`, `9add1bd`, `97c7edc`, `75af109`; newsroom regression checks: `9e4f334`, `1b9c1ef`; handoff: `docs/audit/handoffs/M84-PUBLIC-MEDIA-PREDICTION-ISOLATION.md`.
- Previous exact-head engine suite failed at `34b7457`; later corrections have separate current-head workflow evidence. At `ae9f6fd`, Cloudflare staging deployed and passed through `/matches`, then the protected `/match/{id}` smoke returned HTTP 404 because match-detail was disabled in V2 config. M88 below records the staging-only fix and verification status.


### M88 — Cloudflare staging match-detail activation and runtime repair (2026-11-22)

- The earlier protected Cloudflare staging run [#1295](https://github.com/MketyDigital/Factsport/actions/runs/45001701147) at `ae9f6fdb` returned 404 for `/match/{id}` because `FACTSPORT_MATCH_DETAIL_BACKEND` was disabled. The staging-only PostgreSQL reader gate was then enabled after reviewing migrations 0008 and 0017 and verifying the existing V2 reader grants. No restore/import is required for the clean-start `factsport_v2` database.
- Follow-up staging runs [#1297](https://github.com/MketyDigital/Factsport/actions/runs/45040575831) and [#1300](https://github.com/MketyDigital/Factsport/actions/runs/45040955506) moved the failure from 404 to 500, while confirming the exact reader role, TLS, match-detail columns and public Media views were already readable. No grant migration was needed.
- The protected read-only probe isolated the failing call to team-form lookup. The final V2 implementation bounds history to two years and compares the canonical team names from the match row with parameterized exact equality; it does not use a leading-wildcard scan. The PostgreSQL adapter also preserves a successful read if client shutdown fails while still propagating query failures. Public match-detail JSON strips the ESPN predictor field before serialization. Regression assertions cover these boundaries.
- **Exact-head evidence:** commit `418edd7400e053e27b6bcb020c00b1e5fe695f5b` on `refactor/factsport-v2` passed isolated verification [45044116175](https://github.com/MketyDigital/Factsport/actions/runs/45044116175), native Cloudflare build [45044116156](https://github.com/MketyDigital/Factsport/actions/runs/45044116156), and protected staging [45044117315](https://github.com/MketyDigital/Factsport/actions/runs/45044117315). The staging gate verified the read-only match-detail probe; PostgreSQL-backed `/matches` and a real `/match/{id}` rendered; public Media match surfaces had no Prediction/betting content; article/result/lineup share cards passed PNG and 1200×630 checks; Entra start configuration/PKCE redirect and callback fail-closed checks passed; pagination and access isolation passed.
- This does **not** complete the interactive Entra editor identity-membership/publish/unpublish/logout journey, the complete route/feed/lifecycle and visual/accessibility/rights acceptance, V2 backup/PITR/restore and rollback rehearsal, or the P9A owner go/no-go. Entra staging checks validate configuration and protocol boundaries; they do not prove a human editor is linked and authorized.
- **Next:** complete the remaining P9A Media acceptance and recovery/rollback gates on the isolated Cloudflare deployment. Keep P9B Prediction private and separate, then P10 Factsport TV after Media and Prediction. No production deployment, DNS/routing change, main merge or cutover occurred in this checkpoint.


### M89 — Cloudflare staging homepage and newsroom read cutover (2026-11-22)

- After M88, reviewed migrations 0006, 0007, 0024 and 0025. The clean-start `factsport_v2` schema defines the public featured-match, highlight, homepage-settings, competition-standings and player-stat views; the migrations grant the PostgreSQL reader the required public-view SELECT access and keep underlying homepage settings protected from that reader.
- Enabled `FACTSPORT_EDITORIAL_BACKEND=postgres` and `FACTSPORT_HOMEPAGE_BACKEND=postgres` only in the separate Cloudflare V2 staging Worker. The existing editorial and reader Hyperdrive bindings are used; no new database, restore/import, secrets, role grants, production route, or legacy provider path was added.
- Extended the one-click staging workflow to require token-authorized `/` and `/news` renders, expected Media navigation/headings, and the existing PostgreSQL match, detail, share-card, Entra-boundary and access-isolation checks.
- Exact head `2c79d0fec4072c57654be8d8b4aebb16fa5e7e6c`: isolated verification [45045456878](https://github.com/MketyDigital/Factsport/actions/runs/45045456878) passed. Cloudflare staging build/deploy and protected-route checks [45045456852](https://github.com/MketyDigital/Factsport/actions/runs/45045456852) passed, including both newly enabled page routes.
- This proves the staging Worker rebuilt and the home/news server-rendered data paths completed; it does not prove that editorial entries, highlights, or featured/homepage rows are populated, nor that all-page visuals, accessibility, crawler reachability, rights, standings/provider ingestion, or the real editor publish journey are accepted.
- Next: inspect the live staging pages at desktop/mobile sizes; implement/verify competition standings only after checking actual provider-fed rows; continue Entra issuer+subject membership and editor draft/review/publish/unpublish/logout, ESPN lifecycle, restore/rollback and route isolation. P9A remains no-go for production until its full acceptance and owner decision. Prediction stays P9B; Factsport TV stays P10.
- No production Worker/domain/DNS/database or Logic App was changed or enabled.


### 2026-11-23 — M90 coordination: branch/CI and release-gate reconciliation

- **Exact branch ref at inspection:** `cdf098b470ce4309370435abaecca981a9343443` (2026-11-22 17:51 UTC), commit `fix: type PostgreSQL tournament match projection`. This commit casts the PostgreSQL tournament match projection to the `LeagueMatchGroup` prop type. It is a source typing change, **not** evidence that tournament/standings data, UI or runtime parity passed.
- **CI evidence boundary:** GitHub commit combined status for this SHA reports a **failed Vercel context** (not the Cloudflare/Vinext acceptance toolchain). The available commit workflow lookup returns no PR-triggered runs and cannot enumerate push-triggered runs, so exact-head isolated tests, native Vinext and protected staging are **UNVERIFIED** here. Do not claim they passed or failed. Historical positive proof: M88 commit `418edd740` isolated #45044116175, Vinext #45044116156, staging #45044117315; M89 commit `2c79d0fec` isolated #45045456878 and staging #45045456852. All precede inspected HEAD and cover narrower paths.
- **Matrix reconciliation:** Public home/news/matches/match detail have narrow protected staging read/render evidence; **not** complete page/route/component/browser/content parity. Tournament/standings data and match lifecycle, ESPN-first 3s linked LIVE/conditional FD fallback, FT correction, CMS authenticated edit/review/publish/unpublish, rights/R2/social, Entra identity and RBAC, account/admin, private Predict/VIP/payment/prizes/points/settlement/monthly audit, chat/MOTM/pins/video, PWA, AI/Mail/indexing/jobs/retention remain **OPEN** without full runtime-appropriate evidence. PostgreSQL 0000–0048 migration/role checks (49 ledger entries, 80 relations, 11 capability roles) are historical **schema-only** evidence; backup/PITR/restore, rollback, load, security, accessibility, SEO and Core Web Vitals remain **OPEN**.
- **AdSense policy recheck 2026-11-23:** Google says the AdSense Sites status must actually be **Ready** after whole-site review; ads.txt authorization alone does not prove readiness (https://support.google.com/adsense/answer/12170222 and https://support.google.com/adsense/answer/12131223). Google's online-gambling publisher restriction explicitly covers bookmaker affiliates/aggregators (https://support.google.com/publisherpolicies/answer/10437963); do not confuse this with separate Google Ads advertiser certification. Owner evidence of site/account Ready, authorized seller, original editorial rights, navigation/legal/affiliate disclosures, live Cloudflare robots/sitemap/ads.txt, eligible non-interactive ad placements and VIP/prize/sportsbook legal disposition is **BLOCKED**. No ad code activation.
- **Next exact safe sequence:** (1) Obtain push-triggered GitHub Actions results for `cdf098b` and rerun isolated tests, TypeScript, native Vinext and protected staging on the **same SHA** if necessary; (2) inspect actual protected staging tournament/standings rows, permissions and mobile/desktop render (read-only); (3) run real Entra editor membership + draft/review/publish/unpublish/logout with denial tests; (4) rehearse isolated PostgreSQL restore/PITR and rollback; (5) exercise a complete ESPN-linked match lifecycle and every remaining matrix row. Correct one bounded staging-only defect only after evidence identifies it.
- **No behavior change in this checkpoint:** runtime credentials, current-head Actions evidence and authorized end-to-end editor identity were not established through this connector, so speculative application edits, database writes or business-rule changes were avoided. Preserve legacy source/backups, original brand assets, and clean-start restrictions. No production DNS/Worker/database/Supabase/schedule/Logic App/AdSense modification, main merge or cutover is authorized or performed by this checkpoint.


### M91 — 2026-11-23 deterministic CI, staging role hardening, and migration-ledger verification

The V2 branch now has a committed lockfile and all 16 V2 workflows use `npm ci`. Local engine tests (292/292), TypeScript, and Vinext build passed. Exact-commit CI on the lockfile commit passed isolated verification, native Cloudflare build, protected staging, 51-migration application, fixture import, read-only DB audit, ESPN preview, and private R2/Hyperdrive smoke. See [M91 handoff](./handoffs/M91-DETERMINISTIC-CI-STAGING-LEDGER.md).

Staging role hardening passed after pinning its temporary Worker deploy to Wrangler 4.158.0. A fresh post-hardening catalog audit exposed a stale ledger assertion (49 expected vs. 51 applied); the audit now requires 51 distinct, checksummed versions 0–50 and passed on current head `d12f690`. It reports 11 roles, 80 public relations, 308 inspected table privilege combinations, and the expected least-privilege boundaries. Temporary Cloudflare Workers were deleted after their runs.

The owner confirms Entra sign-up is complete and the account is visible in both the main Microsoft directory and the Factsport directory. This closes the directory-side account-creation question. The remaining identity acceptance is whether that same account completes the Factsport callback/session, resolves its exact tenant issuer+subject to `external_identities`, receives an active publisher-capable `media_editorial_memberships` role, and completes CMS draft/review/publish/unpublish/logout plus denial checks. M82 recorded a browser callback blocked by the legacy middleware filter; the later callback exception and synthetic fail-closed staging smoke do not prove this existing account's live round trip. **Do not ask the owner to register again.**

This only improves reproducibility and verifies the current staging database. It does not complete the remaining P9A identity, public Media route/feed/provider/lifecycle and visual/accessibility/rights/SEO/CWV acceptance, backup/PITR/restore or rollback rehearsal, load/security checks, or owner AdSense/legal decisions. P9A remains no-go for production until those gates pass and the written Media-only go/no-go is recorded. P9B Prediction and P10 TV remain separate. No production Worker/domain/DNS/database, main branch, legacy deployment, or cutover changed.

### M92 — 2026-11-23 Media frontend repositioning and product-boundary reconciliation

- Owner reports the Entra callback issue is addressed. This updates the issue status only; it is not yet evidence of a completed editor session or publish journey. The existing owner account is already registered in both Microsoft directories; do not request another signup.
- Re-read the governing M74 visual plan, M78 phased release, M84 Media/Prediction boundary, page migration matrix and current app route shell. Media frontend repositioning is **not complete**: M74 remains a first visual slice, with the full match center, newsroom/highlights, matches, standings/league pages, all Media states and visual/browser acceptance still open. The shared public shell is present, but major pages retain their earlier compact UI.
- Started M74-A in `MatchHeaderClient`: expanded responsive team/score panels, clearer live/status and match metadata, visible keyboard focus, decorative-image accessibility, and null-safe scores (unknown scores remain unknown rather than becoming 0). The existing data, match IDs, status logic, score update behavior and match-detail navigation remain in place. Regression coverage asserts unknown-score and responsive/focus contracts.
- **Local checks on this working tree:** `npm run test:engine` passed 293/293; `npm run typecheck` passed; `npm run build:vinext` passed. These local results do not yet constitute exact-head GitHub or protected staging acceptance; the visual change has not received real mobile/desktop screenshot review.
- Reconciled the older parity document's anonymous public Prediction flow as historical/superseded by M84. Public Media contains no Prediction submit/board action; Prediction UI, APIs and business features remain P9B on its own surface. TV is not being folded into either frontend: M78 and TV-001 keep TV as P10 after Media and Prediction stabilize.
- Next: finish M74-A match tabs/lineups/timeline and mobile checks; continue M74-B/C/D/E and route-by-route media/product-shell inventory; verify callback with the existing account through real app CMS actions when owner session is available; complete remaining P9A provider, rights, route, restore and rollback gates. Only then record a Media-only go/no-go. P9B Prediction, P10 TV and production cutover remain separate and open.
- No production Worker, DNS, database, Microsoft tenant, legacy service, schedule, AdSense or TV resource was changed.
