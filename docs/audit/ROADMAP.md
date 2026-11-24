Warning: truncated output (original token count: 18620)
Total output lines: 463

Warning: truncated output (original token count: 36580)
Total output lines: 778

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
- Facebook and Telegram MUST remain direct API integrations. Third-party marketing …8620 tokens truncated…gs, Leagues, News and Highlights. The private Prediction hostname now selects a separate noindex `/` entry page before any Media homepage data query; its route links go to free fixtures as well as the existing private login/register pages. Regression coverage asserts these boundaries.
- **Final local checks:** `npm run test:engine` passed 295/295, `npm run typecheck` passed and `npm run build:vinext` passed. Exact-head GitHub or protected-staging acceptance and real mobile/desktop screenshot review remain open.
- Correction required by owner (2026-11-23): free anonymous Prediction is still required, hosted on `predict.factsport.com` with the central Predict account; do not remove AUTH-005 or its anonymous cookie/email/consent rules. M84 remains the guard that keeps prediction entry and API off the AdSense Media host. The TV deferral/order is superseded: build and track TV alongside Media and Prediction, including the human-reviewed YouTube/social publishing pipeline.
- Next: continue M74 frontend repositioning and provider/rights/restore gates; implement AUTH-005 free play on `predict.factsport.com`; start TV's offline Match Story and video distribution workflow in parallel. Preserve staged/go-no-go boundaries: the master V2 cutover stays blocked until Media, Predict and TV are all complete.
- No production Worker, DNS, database, Microsoft tenant, legacy service, schedule, AdSense or TV resource was changed.

## M93 — Predict host and concurrent TV delivery (2026-11-23)

- Owner clarified that the free prediction experience remains in scope, while all Prediction entry/actions belong on its own `predict.factsport.com` subdomain. The main `factsport.com` Media host must remain free of Prediction UI and API access to protect its distinct AdSense review surface.
- Reinstated AUTH-005 as active host-specific requirements: browse/play freely without registration; request email only after clicking Submit Prediction; optional unticked marketing consent; no anonymous prize entitlement. `/` on Predict now offers a free-prediction path into the fixture list as well as central account sign-in/registration. Match-detail submission is rendered only on the exact configured production subdomain; the Cloudflare staging Worker has a noindex `/predict-preview` entry for browser acceptance. The submission API retains the exact production-host gate and staging-only Workers hostname allowance. Media route stays prediction-free.
- TV is a required concurrent V2 workstream, not a post-cutover deferral. Its evidence-backed Match Story planner, social video package, private YouTube resumable-upload primitive, TikTok creator-inbox draft primitive, and protected read-only storyboard preview are implemented. YouTube uploads start private; TikTok requires explicit upload consent and creator completion. Both require server-held OAuth, cleared sources/assets and human approval. The renderer, durable outbox/studio, Meta/other-social dispatch, TikTok verified media origin and staging acceptance remain open. The master release tracker includes Media, Predict and TV, and cutover remains no-go until all gates plus rollback evidence pass.
- TV visual direction remains cinematic football media: animated 3D for explicitly illustrative match scenes, accurate 2D for data/lineups/overlays where geometry or source facts are limited. No fabricated play presented as real footage.
- Exact head `4fa2da66da00136297b2b000bc99b77c2b9cbd21` passed isolated verification [45218367133](https://github.com/MketyDigital/Factsport/actions/runs/45218367133), native Cloudflare build [45218367793](https://github.com/MketyDigital/Factsport/actions/runs/45218367793), and protected staging [45218368208](https://github.com/MketyDigital/Factsport/actions/runs/45218368208). Staging completed deny-by-default routes, Media/Entra readiness, the read-only Hyperdrive database preflight, public homepage/news/match journeys and share-card checks. The earlier one-shot preflight 404 did not recur; bounded retries and sanitized diagnostics are retained. Prediction submissions remain disabled in staging until their dedicated writer/schema readiness is complete. This staging pass is not a visual screenshot or full Entra membership/publish journey.
- M74 match-center visual continuation: the scoreboard hero adds a low-contrast 2D pitch in CSS perspective, a slow stadium-light glow, and layered score treatment. A second source increment adds elevated timeline cards and a gradient rail. Both honor `prefers-reduced-motion`; source events and score values are unchanged. Exact-head CI/staging pass; full M74 still needs browser and accessibility acceptance.
- TV preview UI increment: protected `/admin/tv` now exposes a read-only, noindex storyboard prototype for 2D lineups, an abstract 2.5D field, unknown-safe stats and explicitly illustrative 3D direction. It is not connected to feeds, rendering, storage or social accounts; it is not a renderer or publish control. Exact-head CI/build/staging pass; editor-role browser review remains open.
- Exact head `e86690f8488dbf25534eda60864e49a12929852c` passed isolated verification [45220923630](https://github.com/MketyDigital/Factsport/actions/runs/45220923630), native Cloudflare build [45220923394](https://github.com/MketyDigital/Factsport/actions/runs/45220923394), and protected staging [45220923298](https://github.com/MketyDigital/Factsport/actions/runs/45220923298). This verifies deploy and protected checks, not a real TV editor browser session or social publish.
- No production host, DNS, Worker, database, social credential or schedule changed in this checkpoint.

## M94 — Media and TV first release sequence (2026-11-23)

The owner has clarified release order: finish Media and TV, prepare a scoped `factsport.com` cutover, then continue the broader Predict product and monetization work. Preserve the existing free-prediction experience on `predict.factsport.com` during the Media/TV release. Its production Worker, DNS, cookies, routes and free-play behavior must remain unchanged; the broader Predict migration has a separate later P9B gate. This supersedes M93's combined Media/Predict/TV release ordering, not the Media/TV quality, rights, recovery, rollback or owner go/no-go requirements.

Source work in this increment:
- The homepage headline carousel now has manual previous/next and pause/play controls, pauses on hover/focus, and disables automatic rotation for reduced-motion users by default.
- Factsport TV now has a rights-gated offline SVG scene-frame compiler for 2D data scenes and clearly disclosed abstract 2.5D illustrative scenes. The protected read-only storyboard preview now displays the compiled frames beside its visual concept panels, using only a clearly labeled fictional synthetic fixture. It does not create a final animated video, rely on match footage, or post to a social account. Human review, real content rights, MP4 encoding, durable jobs/storage, OAuth and social publishing acceptance remain open.
- The production plan now defines two release windows: Media/TV first with an explicit unchanged Predict route check; full Predict later. It does not authorize or perform a production switch.

Exact head `dbe8cfdd46af46e7b90d8d4fd54bf2d7d9ddd712` passed the 308-test engine/regression suite, TypeScript, native Cloudflare/Vinext build and protected staging workflow: [isolated verification](https://github.com/MketyDigital/Factsport/actions/runs/45265807625), [native build](https://github.com/MketyDigital/Factsport/actions/runs/45265807706), [protected staging](https://github.com/MketyDigital/Factsport/actions/runs/45265807572). Staging verified deny-by-default access, PostgreSQL-backed homepage/matches/news, match detail, share-card renders, public Media/Prediction separation, and database/API isolation. It did not exercise a real Entra editor membership/publish journey or open the private TV storyboard in a browser; visual/accessibility and TV editor acceptance remain open. No production route, DNS, credential, social post, database or schedule changed.

## M95 — Offline TV video proof and Media/TV release progress (2026-11-23)

The owner-directed Media/TV-first release sequence continues to preserve the current `predict.factsport.com` service and free-play behavior; the broader Predict migration stays separate for P9B. The main `factsport.com` Media experience remains prediction-free.

- Added `scripts/render-tv-preview.mjs`: it makes a fictional local story through the verified-plan gate, scene SVG renderer, Resvg rasterization and FFmpeg H.264 encoding. A locally inspected sample is 15 seconds, 1920×1080 at 25fps, with a small camera move and explicit synthetic/nonpublishable labels. It contains no real match data, player likeness, footage, audio, captions, upload, or platform interaction. The sample is a pipeline proof, not a ready social episode.
- Added `@resvg/resvg-wasm` as a direct, version-pinned dependency and a regression check for script syntax and the absence of a network publishing path. Review its MPL-2.0 license as part of production render-host approval.
- Exact source head `e89103f4a7c3b21395ddc49aeb1106e1ac942a8b` passed isolated verification [45271817408](https://github.com/MketyDigital/Factsport/actions/runs/45271817408), native Cloudflare/Vinext build [45271817531](https://github.com/MketyDigital/Factsport/actions/runs/45271817531), and protected staging [45271817645](https://github.com/MketyDigital/Factsport/actions/runs/45271817645).
- The current staging workflow did not play this local MP4 or review `/admin/tv` in an authenticated browser. Full Media visual/accessibility/rights/restore acceptance; TV four-minute rendering, sound/captions, durable render/storage/outbox, OAuth and human-reviewed social acceptance; Entra editor membership/publish; and route rollback remain open. No production route, DNS, content, credential or post changed.


## M96 — TV episode workflow schema and publish approval guard (2026-11-24)

- Added isolated V2 TV migrations for durable episode revisions, frozen snapshots, scenes, private-media asset lineage, render jobs, human approvals, a platform outbox, delivery attempts and audit records.
- Added a database-side publish guard: enqueue requires the approved episode revision, a matching human publish approval, an active rights approval and a cleared video asset. Package/approval fields remain immutable to the dispatcher, whose grants are limited to delivery state and receipts.
- Advanced the guarded staging migration workflow's expected ledger through version 52. Guarded run [45319655896, attempt 2](https://github.com/MketyDigital/Factsport/actions/runs/45319655896) applied versions 51–52 to isolated `factsport_v2`; disposable PostgreSQL migration verification passed [45319638874](https://github.com/MketyDigital/Factsport/actions/runs/45319638874). Isolated verification at source `3e5f742` passed [45320132831](https://github.com/MketyDigital/Factsport/actions/runs/45320132831); native build and protected staging preflight remain in progress.
- Still open: read-only sports snapshot API, TV Studio CRUD, signed R2 asset flow, external renderer/leases, caption/audio muxing, output QA, rights evidence, OAuth and platform dispatch, editor browser acceptance. The existing free Prediction host remains outside this release.
- No production route, DNS, database, credentials, schedules or social posts changed.


## M97 — Entra-protected TV episode inventory (2026-11-24)

- Added a read-only `GET /api/admin/tv/episodes` endpoint under the Entra-backed TV capability and existing V2 editorial DB writer binding. It returns bounded private episode summaries with no-store caching.
- Connected the TV workspace to show inventory, access-denied and unavailable states while keeping the synthetic scene preview visibly separate from publishable episodes.
- This establishes the first persisted Studio read path only. No episode create/edit, snapshot build, render worker, signed R2 link or social dispatch is implemented. Authenticated owner browser acceptance and exact-head staging deployment remain pending.
- Preserves the current `predict.factsport.com` free-play service and the Media/TV release boundary.


## M98 — rights-gated Match Story draft entry (2026-11-24)

- Added Entra-protected final-match listing and same-origin draft creation from canonical V2 match rows. The API validates final status and non-null scores, freezes a deterministic score-only source plan, and writes an idempotent private episode/audit record.
- Every newly created episode remains `blocked_rights`; provider/data and asset rights are false, script/audio are unstarted, and there is no render job, upload or publish action. Missing scores and non-final matches are rejected. No third-party event prose is copied.
- The workspace now shows final match options, creates the blocked draft, and refreshes the private episode inventory. Existing Entra registration is reused; active TV role membership is still required and the owner’s browser journey remains open.
- Exact-head isolated verification `1b83e87` passed [45321681478](https://github.com/MketyDigital/Factsport/actions/runs/45321681478); native build/protected staging are pending. The scoped Media/TV release still preserves the existing free Prediction host.


## M99 — evidence-linked narration draft editor (2026-11-24)

- Added a protected episode-detail API and a script-draft editor in the TV workspace. Narration blocks must cite verified facts from the frozen episode plan; text is bounded, optimistic-concurrency checked and audit logged.
- Saving narration keeps the episode rights-blocked and does not advance review status, clear rights, enqueue a render, generate audio, or post to any platform.
- Exact-head isolated verification `3c3b110` passed [45323117266](https://github.com/MketyDigital/Factsport/actions/runs/45323117266). Native build and protected staging preflight remain in progress; authenticated owner browser acceptance remains open.
- The existing free Prediction host remains outside this workstream.


## M100 — independent TV script review and storyboard draft (2026-11-24)

- Added a self-review-resistant editorial approval bound to the current script digest and episode revision. Script edits clear that approval and remove saved storyboard scenes.
- Added a persisted, protected storyboard draft: one source-linked 2D fact-card scene per approved narration block, with estimated timings and no external assets. The Studio displays scene text and fact references.
- This advances the episode from script draft into editorial planning only. It does not clear source or asset rights, advance status, create audio/video/render jobs, or publish. Rights evidence, real editor browser acceptance, 4-minute renderer/audio/caption QA, durable asset storage, channel OAuth, publisher journey and human-reviewed platform dispatch remain open.
- Exact source head `aa0a5e9` passed isolated verification [45324494210](https://github.com/MketyDigital/Factsport/actions/runs/45324494210), native build [45324494239](https://github.com/MketyDigital/Factsport/actions/runs/45324494239), and protected staging preflight [45324494220](https://github.com/MketyDigital/Factsport/actions/runs/45324494220). The free Prediction service and current production routing remain untouched.


## M101 — animated private storyboard preview (2026-11-24)

- Added a scene-by-scene private Studio preview for persisted, independently approved storyboards: animated broadcast framing, an abstract 2.5D pitch, source-linked fact cards, approximate timing, accessible scene selection and previous/next controls.
- The preview observes reduced-motion settings and labels the abstract visual as illustrative. It does not render or upload media, depict real match events, use player likenesses, or change rights/status.
- Exact source head `454c932` passed isolated verification [45342942972](https://github.com/MketyDigital/Factsport/actions/runs/45342942972), native build [45342942964](https://github.com/MketyDigital/Factsport/actions/runs/45342942964), and protected staging [45342943031](https://github.com/MketyDigital/Factsport/actions/runs/45342943031). TV acceptance still needs the real Entra editor browser journey, rights, production renderer/audio/caption QA, durable private assets, OAuth and human-reviewed social publication. The free Prediction subdomain and production routes are unchanged.


## M102 — visible fact provenance in TV scene preview (2026-11-24)

- Added the underlying source and observation time to each fact card in the private TV storyboard preview and scene list, keeping evidence visible during editorial review.
- Exact head `3f0d6c6` passed isolated verification [45343476559](https://github.com/MketyDigital/Factsport/actions/runs/45343476559), native build [45343476547](https://github.com/MketyDigital/Factsport/actions/runs/45343476547), and protected staging [45343476525](https://github.com/MketyDigital/Factsport/actions/runs/45343476525). No rights, status, rendering, OAuth or publication gate changed. Prediction routing remains unchanged.


## M103 — private 3D model asset intake (2026-11-24)

- Added a reusable, private model library and episode links, with protected upload/list/download endpoints. The Studio accepts self-contained GLB 2.0 stadium, generic-player and football assets up to 32 MiB, rejects external file references, and records a SHA-256 digest plus submitted source/license details.
- All submissions stay `pending`; owner-entered “free to use” wording is not treated as rights evidence. No model is used by the renderer or publisher until an authorized rights review clears it.
- Staging migration 0053 is applied to isolated `factsport_v2`; guarded ledger run [45353663369](https://github.com/MketyDigital/Factsport/actions/runs/45353663369) reports versions 0–53 across 54 migrations, and disposable PostgreSQL migration verification [45353666408](https://github.com/MketyDigital/Factsport/actions/runs/45353666408) passed. Exact code head `cb2d13a` passed verification [45354250796](https://github.com/MketyDigital/Factsport/actions/runs/45354250796), build [45354250921](https://github.com/MketyDigital/Factsport/actions/runs/45354250921) and staging [45354251013](https://github.com/MketyDigital/Factsport/actions/runs/45354251013).
- For generic, non-identifiable 3D players/animation, candidate sources are Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html); both official pages mark the packs CC0 and describe commercial use. Keep the package's license file with provenance and avoid real player likenesses.
- The stadium model itself is still needed from the owner; its upload and exact source/license review remain open. Upload limit is 32 MiB, so optimize/export larger source files as self-contained GLB or add multipart upload.

## M104 — independent 3D asset rights review (2026-11-24)

- Added a `rights_admin`-protected model review API and Studio decision form. Only a media admin can clear, restrict or revoke a model; the uploader cannot review their own asset.
- A clear decision requires a license name, source/license evidence URL and written review note. Evidence is recorded with the reviewer and timestamp and audited; the API does not fetch or attest to external URLs. Revoked versions cannot be re-cleared.
- This resolves the rights-decision workflow in code, but not the actual stadium-model rights evidence, real editor-session acceptance, renderer integration, final video QC, OAuth or human-reviewed social delivery. The 32 MiB upload limit remains.
- Exact head `f002be521e6013a022adb25a5a090c55678225b6` passed isolated verification [45356633949](https://github.com/MketyDigital/Factsport/actions/runs/45356633949), native Cloudflare build [45356633844](https://github.com/MketyDigital/Factsport/actions/runs/45356633844), and protected staging [45356633825](https://github.com/MketyDigital/Factsport/actions/runs/45356633825). Staging verifies the protected deploy/preflight, not the authenticated media-admin review journey. No production route, database, credential or social account changed.


## M105 — original procedural 3D look-dev proof (2026-11-24)

- Added an offline Blender look-dev scene built from original procedural geometry: stadium bowl, pitch markings, goal frames, animated camera path and rolling football. It uses no external models, real teams, player likenesses, logos, provider data or footage.
- Generated and visually inspected a 3-second 960×540 H.264 proof at 24 fps. The clip carries visible “fictional / illustrative / not match footage” disclosure and has no audio or social delivery.
- This demonstrates a true 3D visual direction alongside the private 2D/2.5D storyboard. It is not the required 3–5 minute episode renderer, does not load the owner’s stadium model, and does not satisfy audio, captions, QC, durable render-job or publishing acceptance.
- The owner's `.glb` and source/license evidence are still needed before model-based rendering. No production route, R2 public access, social OAuth or post changed.
- Exact head `2639d84a83d817f6ae7968afce8f2377a5df1357` passed isolated verification [45358005169](https://github.com/MketyDigital/Factsport/actions/runs/45358005169), native build [45358005177](https://github.com/MketyDigital/Factsport/actions/runs/45358005177), and protected staging [45358005256](https://github.com/MketyDigital/Factsport/actions/runs/45358005256). The staging run proves deploy and deny-by-default preflight, not authenticated TV editor acceptance.
