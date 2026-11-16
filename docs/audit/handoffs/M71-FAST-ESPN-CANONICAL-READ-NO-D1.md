# M71 — Original ESPN Worker mapping restored to a gated, same-origin V2 fast reader (without D1)

Date: 2026-11-16
Branch: `refactor/factsport-v2`
Status: source implementation and regression tests committed, small local normalizer sample executed; full Next/Vinext builds, protected staging, Cloudflare cache/load behavior and provider parity NOT verified.

## Source and owner guardrails

Read the **exact original** `docs/audit/legacy-source/external-fast-espn-motm-d1-worker-v1.js.txt` supplied by the owner in M70 (17,742 UTF-8 bytes; SHA-256 `591825b4bf374703d0e32580e55eb2c6d19dac9f0238f3689f7037744dbb9c53`). The original Worker combined an ESPN soccer summary proxy with a separate D1-backed MOTM GET/POST endpoint. V2 **must not use D1 actively**. The legacy external chat Worker is similarly archived under M70, not deployed/imported. Separate scheduled database ingestion and social notification workflows must not be mixed into the viewer cache.

## Recovered transformation

`lib/live/legacy-espn-summary.mjs` extracts the actual source transformation of the uploaded Worker, from competition header through final commentary-derived `payload.match_events`. It retains:
- ESPN pre/live/half-time/final status mapping and display-clock/commentary time adjustment.
- Home/away scores, shootout penalties, half-time scores, aggregate, venue, referees and source predictor/projection data.
- Team possession, fouls, corners, saves, shots/on/off target.
- Starting lineups, positions, numbers, formations and alternate boxscore team roster layout.
- Commentary-derived goals, assists, VAR decisions, penalties, shots, yellow/red cards and substitutions; reverse chronological ordering to oldest first.

Two unsafe legacy behaviors were intentionally improved:
- Invalid, missing or blank scores are `null` rather than silently fabricated `0`.
- IDs for the same commentary events derive from ESPN-provided IDs where present, otherwise a deterministic lightweight content hash of ESPN ID, minute, description, event kind and participants. This replaces `crypto.randomUUID()` on every cache refill; these IDs are *best-effort stable source identifiers*, not cryptographic security or guaranteed duplicate-free event keys. Upstream content mutation can still change an ID.

The module contains no D1 references, original MOTM endpoint, provider fetch handler, or imported Cloudflare Worker event context. `lib/live/legacy-espn-summary.d.mts` declares its public payload interface.

## V2 same-origin fast read

Added `GET /api/media/live/matches/[id]`:
- **Disabled by default**. Requires BOTH `FACTSPORT_FAST_LIVE_BACKEND=postgres` and `FACTSPORT_MATCH_DETAIL_BACKEND=postgres`; no direct untrusted ESPN ID parameter or Supabase fallback.
- Uses the canonical V2 match UUID (legacy UUID alias resolving remains in the existing `getPostgresMatchById` adapter) to resolve a verified `espn_id` from Mkety Core PostgreSQL.
- Fetches the same ESPN soccer summary endpoint with ~3.5-second timeout and ~1.25MB bounded response, then normalizes using the extracted module.
- Uses canonical match ID + verified ESPN ID for a normalized Cloudflare Cache API key when available; TTL follows legacy intent: ~3s live/HT, 60s scheduled, 3600s finished. Staging is private/no-store.
- Exposes `id`, `espn_id`, `source`, `observedAt`, `servedAt` and `stale` metadata; never claims DB fallback is fresh.
- If ESPN is absent or fails, returns the latest PostgreSQL match snapshot marked `source: postgres_snapshot`, `stale:true` and `no-store`. Provider failures are not by themselves evidence of ESPN global outage or permission to switch the canonical database writer to FD.
- **This route is read only**: it never writes matches, Prediction settlements, social posts, MOTM votes or chat messages, and has no active D1 dependency.

The actual Cloudflare Cache API runtime, cache consistency and cross-region stampede limits are not verified. Browser polling must not be switched until a staging load test confirms the fast path avoids excessive ESPN calls.

## Frontend switch

`app/utils/liveFetcher.ts` now supports an optional canonical `matchId`. It retains its original request-in-flight Map, but keys same-origin mode by canonical match ID. When `NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND=postgres` is explicitly selected, it calls the new same-origin endpoint and refuses invalid/missing canonical UUID rather than silently falling back to an untrusted ESPN ID. Otherwise, existing external ESPN *read* requests remain unchanged to avoid premature public cutover.

`MatchLiveProvider.tsx`, `app/match/[id]/page.tsx`, and `LiveScoreLabel.tsx` pass the match UUID to the shared fetcher. This retains the existing live (3s) and scheduled (60s) match-page cadence and score-label cadence, pending parity measurement. The old Worker *root ESPN read* does not perform D1 queries; its separate MOTM D1 path is disconnected in M70.

## Tests and source check

- `tests/media-fast-espn-no-d1.test.mjs`: synthetic rich ESPN fixture tests for status, score `null`, venue, referee, stats, lineups, stable events, score validation, upstream identity and gated route/cache/fallback/source boundary. Additional source checks protect canonical match UUID wiring through fetcher/page/score label.
- An isolated Node 22 local sample generated from the exact uploaded ESPN mapping transformation completed successfully: LIVE state, null home score, numeric away score, stable IDs and goal/card recognition. The original two uploaded scripts passed `node --input-type=module --check`.
- Full `npm run test:engine`, TypeScript, Vinext build, runtime Cloudflare edge cache, Hyperdrive connection and live ESPN integration were **not** executed/verified.

Selected commits:
- `8f0c7ca252177409012294e1ffd1c79c949139c8` — D1-free extracted original transformation
- `cdba7a0926751e3fdaf77db4997fd02c5593f879` — canonical-ID fast route with safe fallback
- `68c9bbc1ddb540076007427f47514a45ccb12c68` — normalizer module typing
- `af618fc6e164626458cdf9887e5f85fe8c1879a5` — backend flag typing
- `d1f7205507c3a96e44e1d3f2ead25ea32afb549e` — parser fixture and no-D1 route tests
- `7c06f67a10112a71188f16088f309ca5436dc632` — opt-in browser fetcher
- `b702cf607817839b3da8f70002cf80be1434e81d` — match-page provider ID
- `61d4007b19ac354e244917955a79a77ac77fce04` — match page ID
- `c067c9b6bb6f6a6240ef18e5e85091d549a686af` — score labels ID
- `39f4931a44a98e25b4a7a6afa8b38be67697ae2b` — client switch tests

## Remaining launch gates

1. Execute full Node/TS/Vinext suite; check Cloudflare Worker deployment import of `.mjs`, `.d.mts` types, Cache API availability, and V2 match UUID/legacy aliases.
2. Verify backend flags, migration 0008 and Hyperdrive reader role; only activate in protected staging.
3. Compare real live ESPN payload against original deployed legacy Worker: clocks, penalties, match status, roster variants, event identity, cached TTL and stable display, and match page rich data.
4. Load test 3s global live polling at expected concurrency. Add bounded cache-miss coalescing, ESPN quota protection, provider timeout telemetry, and error budgets if cross-POP stampedes are observed.
5. Connect authentic media-identity chat moderation and MOTM write actions on PostgreSQL (M70). Preserve chat pins and official events while eliminating old Supabase admin writes.
6. Build the independent scheduled canonical match writer, social outbox, and verified ESPN/FD source policy; keep Prediction settlement separate.
7. No production DNS/old Worker/custom-route, D1, provider account, paid Cloudflare Stream VOD, or billing change without explicit approval.

## M71 follow-up — stale fallback must not regress a live browser

The same-origin endpoint intentionally returns `stale:true` for its last stored PostgreSQL fallback. The legacy `MatchLiveProvider` and `LiveScoreLabel` originally merged any non-error payload, which could roll visible live scores back to older database values after an ESPN request fault. Both frontend consumers now skip updates with `stale === true`, while retaining the server-rendered initial snapshot and last good live observations. Added the corresponding source-regression assertion to `tests/media-fast-espn-no-d1.test.mjs`.

Commits: `45cba3052b148142c638555603a8f571104c6cef`, `e0de0491b96a5987112e569c98cb94bb95ab01e0`, `7d2e62a532612ee0b05a87a14b4b7c986dadd6f8`.
