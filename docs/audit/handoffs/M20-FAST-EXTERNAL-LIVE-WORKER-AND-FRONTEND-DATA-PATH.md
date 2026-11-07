# M20 — Fast External Live Worker and Legacy Frontend Data-Path Reconciliation

Date: 2026-11-07
Repository: MketyDigital/Factsport
Target: refactor/factsport-v2
Status: documentation and repository-source reconciliation; external Worker source was owner-supplied in the earlier audit and is documented in WORKERS-001. No runtime/deployment verification or production changes.

## 1. Purpose and critical correction

This handoff explicitly closes a common migration misunderstanding: legacy `app/api/live/route.ts` is NOT the fast frontend live-score API.

The legacy product had two separate ESPN live-data paths:

1. **Fast viewer/frontend path:** external Cloudflare Worker exposed at `https://live-api.factsport.com`. The browser and server-rendered match page call it directly for fast ESPN live payloads. It proxies ESPN summary data and uses Cloudflare Cache API.
2. **Background database synchronization path:** external cron-job service calls the legacy `/api/live` route approximately once per minute, as confirmed by the owner and recorded in WORKERS-001. This path updates Supabase match snapshots and attempts social notifications.

They are complementary, not interchangeable. A V2 database updater alone does not preserve the live frontend experience. A V2 ESPN proxy alone does not keep canonical match records, public snapshots, repair data or downstream workflows synchronized.

## 2. Source of truth and evidence

Read together:
- `docs/audit/WORKERS-001-external-workers-and-consolidation.md` — owner-supplied external Worker descriptions and repository source correlation.
- `docs/audit/SPORTS-001-fixtures-standings-schedules.md` — primary fixture source, ESPN mapping, user correction and provider policy.
- `docs/audit/SPORTS-002-verified-provider-failover.md` — conditional FD live fallback policy and health classification.
- `docs/audit/handoffs/M18-LEGACY-MEDIA-PLAYER-LIVE-STUDIO.md` — Media ownership and background live route behavior.
- Legacy `app/utils/liveFetcher.ts`, `app/providers/MatchLiveProvider.tsx`, `app/components/LiveScoreLabel.tsx`, `app/match/[id]/page.tsx`, `app/api/live/route.ts`, and `app/api/match-data/route.ts`.

Evidence limits:
- The external live Worker source was supplied by the owner in the earlier audit; it is not a checked-in source file in the V2 repository tree.
- Exact deployed Worker configuration, route bindings, cache behavior under production traffic, ESPN quotas, scheduled triggers and current health have not been independently verified in Cloudflare.
- The cron-job.org (external cron service) one-minute call to `/api/live` is owner-confirmed, not independently dashboard-verified.
- The repo source and earlier handoff say fast Worker live cache approximately 3 seconds, scheduled approximately 60 seconds, finished approximately 3600 seconds. Treat as documented legacy intent/source behavior, not runtime measurements.

## 3. Exact legacy frontend fast path

### Browser fetcher — `app/utils/liveFetcher.ts`

- Calls `https://live-api.factsport.com/?espn_id={espnId}&_t={Date.now()}`.
- Uses `fetch(..., { cache: 'no-store' })` to bypass aggressive browser caching and let Cloudflare perform the intended caching.
- Keeps an in-module `Map<espnId, Promise>` to deduplicate simultaneous in-flight requests within the browser JS module.
- Removes the request from the map when it completes.
- This map is only request coalescing in one browser runtime; it is not durable server-side deduplication, a shared cache or a job lock.

### Match details provider — `app/providers/MatchLiveProvider.tsx`

- Seeds client state with server-provided `initialData`.
- Immediately fetches fast Worker data on mount for ESPN-linked, non-finished matches.
- Polls every 3 seconds when current status is live; every 60 seconds otherwise.
- Stops polling when the match is finished or no ESPN ID is present.
- Updates score, status, clock, stats, lineups and event arrays while preserving prior rich data when some fields are absent.
- Re-seeds from newer router/server `initialData` after soft navigation.
- It does not use `/api/live` as the browser polling endpoint.

### Other score UI — `app/components/LiveScoreLabel.tsx`

- Also calls the same shared `fetchLiveMatchDeduplicated(espnId)`.
- Its own poll cadence is 10 seconds for live status and 60 seconds otherwise, not the MatchLiveProvider's 3-second cadence.
- This is a separate UI consumer of the same fast Worker. Avoid assuming every legacy component polled at exactly 3 seconds.

### Server-rendered match page — `app/match/[id]/page.tsx`

- Its metadata generation calls `https://live-api.factsport.com/?espn_id=...` for live matches, with Next fetch revalidation of 3 seconds, to generate live score/title/description/social preview data.
- The match page itself uses DB match data and the MatchLiveProvider for client refresh.
- The external fast Worker therefore powered both browser live UI and server-side live metadata, not merely a standalone widget.

### Fast Worker response payload (documented)

The earlier owner-supplied Worker description records:
- ESPN summary endpoint proxying.
- Condensed score, status and display clock.
- Player/team statistics and lineups.
- Commentary-derived events.
- Venue, referee and predictor data.
- Cloudflare Cache API with TTL selected from returned match state.
- Live payload cache about 3 seconds, scheduled about 60 seconds, finished about 3600 seconds.

The external Worker description also records wildcard CORS, client-supplied ESPN ID, cache-busting query behavior, random UUID event IDs on uncached responses, no documented request throttle/concurrency cap/provider timeout, and parsing that can turn missing/invalid scores into 0. These are legacy behaviors/risks to correct, not requirements to reproduce.

## 4. Separate legacy DB/background path — `app/api/live/route.ts`

- Called by external cron-job service approximately every minute (owner-confirmed).
- Uses Supabase service role and a CRON_KEY query parameter.
- Selects ESPN-linked matches from a time window approximately 24 hours before to 2 hours after now.
- Includes live/upcoming, recently finished and finished-but-missing-events matches for refresh/repair.
- Fetches ESPN scoreboard and per-match detail data; writes status, scores, clock, events, stats, lineups and supporting venue/stage/group/referee/predictor fields to Supabase.
- Attempts social change notifications directly through `/api/social`.
- Uses a module-local `Map` for state dedupe, not a durable lock/outbox. Its outbound social fetch is not awaited; process restart/isolate changes can repeat or lose notification attempts.
- It is a database synchronization and side-effect path, not the fast frontend response cache.

The one-minute cadence is confirmed in the owner-provided WORKERS-001 note; do not confuse it with the external fast Worker cache TTL or the browser poll interval.

## 5. No ESPN ID and fallback path

- Fast Worker requires an ESPN ID. It cannot serve a fixture that has not been linked to ESPN.
- Legacy UI uses stored DB/match data routes such as `/api/match-data` and server match detail reads for unmatched fixtures.
- `/api/match-data` returns a narrow match projection and caches approximately 5 seconds live, 60 seconds scheduled and 3600 seconds finished.
- football-data.org is the primary free-tier fixture/competition ingestion source; ESPN fills coverage gaps and becomes preferred fast live provider for every correctly ESPN-linked fixture, including FD-origin matches.
- FD live updates remain necessary for unmatched fixtures and can be used for a matched fixture only under the owner-approved conditional fallback policy after independent ESPN upstream degradation is verified and local pipeline health is established.
- FD final-time results remain a separate verification/reconciliation path. A provider's lack of change is not proof of outage.

## 6. Required V2 topology — one centrally managed deployment, separate responsibilities

V2 should consolidate ownership and operations into the managed Factsport Cloudflare deployment, while preserving distinct modules, route contracts and failure boundaries:

### A. Fast public Media live read route
- Same-origin route such as `GET /api/live/matches/:matchId`.
- Resolve canonical match ID server-side to a verified provider mapping; do not trust arbitrary ESPN IDs supplied by clients as authority.
- For ESPN-linked matches, fetch/serve normalized ESPN live payload through a short edge cache (target 2–3 seconds while live, configurable).
- Preserve scheduled/finished TTL behavior with explicit freshness semantics.
- Return normalized `status`, score, clock, events, lineups, stats, source/provider, `observedAt`, `servedAt`, `stale`, and a safe match identity.
- Keep fast viewer polling independent from PostgreSQL write cadence; normal viewer polling must not trigger a database write per viewer.
- For unmatched matches, serve the latest validated DB/FD snapshot via a distinct fallback response path.
- On provider error, optionally serve last-known-good data with accurate stale metadata; never relabel stale data as fresh.
- Enforce provider timeout, concurrency/rate budgets, cache key normalization, bounded response size and safe status/score parsing.
- Remove wildcard CORS unless a documented external browser consumer requires it; same-origin frontend needs no wildcard CORS.
- Do not copy the old external hostname as a permanent V2 dependency. DNS/domain cutover is a separate approved release step.

### B. Durable Media background ingestion
- Cloudflare scheduled dispatcher/internal function updates canonical match snapshots, provider observations, event repair and social outbox.
- Keep provider fetch cadence independent of client polling. Avoid an ESPN request per page viewer.
- Use durable per-match/provider observation state and compare-and-set/versioning; preserve event identity across repeated polls.
- Separate upstream ESPN health from Worker, queue, DNS, rate limit, mapping and DB health.
- Integrate `lib/match-source-policy.cjs` only after its test execution and real observation metadata are verified. It is a pure policy helper today, not a live route integration.
- Apply conditional FD live fallback only after the approved independent-outage criteria; return to ESPN immediately on verified recovery without allowing stale ESPN responses to regress newer accepted data.
- Final-time score reconciliation and settlement are separate concerns. Prediction settlement remains isolated in Prediction, never inside the Media read proxy.

### C. Scheduling and notifications
- Replace external cron-job.org HTTP callback to `/api/live?key=...` with centrally managed Cloudflare scheduled event and internal function call.
- Keep one-minute cadence only if observed product freshness and upstream quota justify it; schedule and quota need owner-approved tuning.
- Sequence critical work and await it; persist started/completed/failed state, retries and idempotency keys.
- Use transactional outbox for social delivery; no fire-and-forget fetch and no module-local Map as durable dedupe.
- Ensure no duplicate production writers during cutover; disable old cron only after V2 staging and controlled production parity gate.

## 7. V2 branch state at audit time

Verified from branch tree/source:
- V2 has a clean PostgreSQL core match model and provider fields `api_id`, `espn_id`, `source`, `source_updated_at`, `version`.
- V2 has separate Cloudflare binding adapters and request-scoped PostgreSQL client.
- V2 has `lib/match-source-policy.cjs` and regression tests for ESPN-first priority, unmatched FD fallback, final verification, and conditional verified ESPN outage fallback.
- The policy explicitly states it is not wired into routes/schedulers; tests are committed but execution is not yet verified in this audit.
- The V2 tree has no equivalent legacy external live-api Worker implementation or integrated same-origin fast live match proxy route confirmed by this inspection.
- The V2 health endpoint only proves staging DB/table and bucket probes; it does not prove ESPN connectivity, provider freshness, live payload parity, cache behavior or scheduler health.
- Existing V2 match/read paths must be inspected before claiming no live reader whatsoever; this handoff's precise finding is that the dedicated fast external Worker path is not yet shown as replaced by a verified integrated equivalent.

## 8. Regression and acceptance requirements

### Fast path parity
- Verify a linked live match browser request hits the V2 same-origin route and does not call legacy `live-api.factsport.com`.
- Verify initial server data and client updates converge without score/status regression.
- Test 3-second live target, 60-second scheduled cadence, terminal stop behavior and browser tab visibility/throttling.
- Verify event/stat/lineup fields, empty arrays, absent values, clock/HT/ET/penalties, terminal statuses and status normalization.
- Verify same cache key for equivalent match requests; arbitrary `_t` parameters do not create edge-cache fragmentation.
- Verify live cache TTL and stale-while-error semantics under ESPN timeout/429/5xx.
- Verify SSR metadata uses the same normalized safe live snapshot and does not create unbounded ESPN traffic.
- Verify no-ESPN-ID matches continue to show DB/FD live data and clear freshness indicators.

### Provider/failure tests
- Healthy ESPN: ESPN wins for all verified linked matches regardless of fixture origin.
- Unmatched fixture: FD live feed remains available.
- ESPN incident: only verified independent upstream degradation with healthy local pipeline can permit FD fallback.
- Local Worker/queue/DB/network failure: no false ESPN outage; retain last trusted state and surface stale status.
- ESPN recovery: immediate preference restored; delayed FD/old ESPN observations cannot regress state.
- Missing/invalid score never coerced into 0-0.
- FT disagreement is reviewed/reconciled by approved policy; abandoned/cancelled states never auto-settle.
- Event IDs are stable or deduped by provider event identity/content hash, not random IDs regenerated on every uncached response.

### Security/operations
- No public cron key, service-role credential or provider secret in URL, browser bundle, response, logs or Git.
- Rate-limit public reads by safe canonical IDs and edge cache; protect ESPN quota and provider concurrency.
- Restrict upstream destinations and validate ESPN event-to-canonical-match linkage.
- No wildcard CORS by default; no client-selected cache TTL/status authority.
- Trace provider fetch, cache hit/miss, observation timestamp, scheduled job run and DB commit separately.
- Alert on source freshness and scheduled-job failures independently.
- Keep live viewer API read-only; do not couple viewer request success to database write health.

## 9. Immediate next work

1. Treat the fast external live Worker as a missing V2 parity requirement, not an unknown legacy dependency.
2. Inspect existing V2 match-centre route/read models and provider ingestion modules; define the minimal normalized live payload and route contract.
3. Execute the pure provider-policy tests in CI or a verified local checkout; add representative sanitized ESPN and FD payload fixtures.
4. Implement a staging-only same-origin fast live route with short edge caching and explicit freshness metadata, backed by canonical provider mappings.
5. Wire the scheduled DB snapshot updater and durable social outbox separately; do not make the fast route perform per-viewer DB writes.
6. Add browser tests for the live match page, score labels, metadata and unmatched FD fixtures.
7. Only after staging parity and explicit owner approval, plan DNS/Worker/cron cutover. Keep old live Worker and external cron unchanged until then.

No production Worker, external cron configuration, DNS, secret, Supabase row, PostgreSQL migration or live route was changed by this audit.
