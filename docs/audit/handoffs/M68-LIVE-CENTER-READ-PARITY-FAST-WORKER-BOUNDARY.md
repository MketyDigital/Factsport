# M68 — Live Center refresh and rights-cleared media read parity

Date: 2026-11-15
Branch: `refactor/factsport-v2`
Status: focused source implementation and Node regression-test source committed; full suite, Postgres, browser and protected staging not verified.

## Legacy evidence and the important separation

Read `docs/audit/handoffs/M20-FAST-EXTERNAL-LIVE-WORKER-AND-FRONTEND-DATA-PATH.md`, `docs/audit/WORKERS-001-external-workers-and-consolidation.md`, `docs/audit/handoffs/M24-V2-MEDIA-MATCH-METADATA-COMPATIBILITY.md`, `db/migrations/0001_factsport_core.sql`, `db/migrations/0017_factsport_media_match_metadata.sql` and current live page/player/frontend providers.

The old externally hosted `https://live-api.factsport.com` ESPN worker is the **fast frontend data path** (match page ~3s poll, score labels ~10s). The external cron service's approximately one-minute `/api/live` call updates DB snapshots and attempts social notifications. **These are separate responsibilities**. The V2 `app/api/live/route.ts` is intentionally disabled pending safe background ingestion. It must not be treated as the fast viewer API and was not re-enabled by M68.

Legacy fast Worker source was owner-supplied during the earlier audit but is **not** currently checked in. Current deployed Worker health/config/cache and cron schedules have not been independently verified.

## Confirmed frontend gaps

1. `app/components/LiveMediaClient.tsx` previously classified server-rendered initial matches once. Newly ingested canonical scores/statuses were invisible on /live until a reload.
2. In V2 the page called `listPostgresMatchesWindow`, which selects core match data but **does not join Media-owned audio/video URLs**; thus existing coverage cards could silently appear as uncovered whenever the PostgreSQL branch is active.
3. Migration 0017 deliberately stores editorial media in private `match_media`, exposing only rights-reviewed, unexpired, public links through `public_match_media`. A fix must not bypass this rights gate.

## Changes committed

1. Added `listPostgresLiveScoreSnapshot` to `lib/adapters/postgres-matches.ts`: a narrow read-only 72-hour canonical match projection (ID, teams, league, date, scores, status, version/freshness), with a hard 1500-row cap. It does not query ESPN, produce social posts, fetch private match_media or perform writes.
2. Added `GET /api/media/live-scores` as a **distinct** read-only endpoint. It requires the existing `FACTSPORT_MATCHES_BACKEND=postgres` activation flag. Errors and disabled backends return 503/no-store, and staging returns private/no-store. Non-staging public Cache-Control advertises 10-second shared-cache TTL and a short stale window. **Actual Cloudflare CDN caching remains unverified**: response headers alone do not prove edge response storage.
3. Added a visibility-aware, single-flight, 15-second client refresh to `LiveMediaClient`. It aborts on unmount, retains last good data on errors, merges score/status/freshness fields by canonical match ID, preserves the initial page's rights-approved audio/video URLs, and retains local-day grouping. A match that becomes final is excluded from active live coverage, matching the initial page filter.
4. Added `listPostgresLiveCoverageWindow`, a separate query joining only `public.public_match_media` for publicly allowed Media video/audio/stream fields and display clock. Updated `app/live/page.tsx` to use this rights-cleared view rather than the core-only list.
5. Added `tests/media-live-score-refresh.test.cjs`, containing five source regression tests: read-only projection, backend/HTTP gate, visibility/cleanup and non-media-overwriting merge, rights-cleared coverage join, and separation from the documented fast Worker and disabled background `/api/live` writer.

Commits:
- `193177b673420596567b8fa6f5b6791d9acd7a1a`: lightweight score reader
- `ae88bed294005edcaf54522c67932fc4a6487b37`: gated score route
- `21db1faa73f93ff428147e5f13c78218d8bdcb7b`: client refresh
- `a9e200f8e64c57ceb23faa6df8e7d1d8be24505c`: live-finished filtering
- `578f462e6ce35ae21082ebef7dcde32f7a7e911c`: initial regression tests
- `1fbbba1f7ad861128b9e14c66db6fa68b5fb3cdc`: rights-cleared Live Center query
- `4686e8c3b117c34914cda678aa2a96fd6d9746d3`: page integration
- `1d470cbdebc3c470e2772f04e8b1d730577fbca7`: coverage and topology tests

## Important limitations / release gates

- **This is a DB-backed Live Center refresh, not the target fast ESPN viewer path.** The match-page `MatchLiveProvider` still calls the old external Worker, and the 3-second ESPN proxy/normalization/cache equivalent is not yet built in V2. No claim of fast-worker cutover or feature parity is made.
- The legacy external `/api/live` background writer remains intentionally disabled. Cloudflare scheduled ingestion, canonical provider observations, event-repair identity, transactional social outbox and verified ESPN/FD fallback remain separate work. Never automatically activate two live writers.
- The 15-second reader uses request-scoped PostgreSQL and may generate material connection/read load under traffic. Benchmark real Cloudflare Cache API/rate limits and cap query volume before enabling broadly; Cache-Control response headers do not establish that Worker responses are cached.
- The V2 `public_match_media` view is created in migration 0017. The dedicated Media projection must not be enabled until migration and reader role grants are verified on isolated staging Postgres.
- Page public Media sources remain rights-gated; the score endpoint intentionally omits broadcast URLs. The browser merge preserves already received media URLs, so expiry/revocation may require a server-triggered page refresh or a separate rights-aware invalidation flow. This is an explicit outstanding revocation/staleness risk.
- `LiveScoreLabel`, match-page rich live provider, match metadata/social preview and the existing external ESPN worker still require parity/routing, provenance and failure policy audits. Do not confuse their cadence with this coarse score refresh.
- Full `npm run test:engine`, TypeScript, native Vinext build, isolated Postgres, protected Cloudflare staging, browser network/load and Media rights-revocation E2E have **not** been run or verified. Source-only inspection is not runtime validation.

## Next work

1. Implement the **canonical-ID, same-origin fast ESPN viewer route** with short Cloudflare edge cache, TTL by status, timeout, safe normalized scores, lineups, events, stats and correct stale metadata. Keep provider writes separate.
2. Rewire `liveFetcher`/match page/score labels behind a reviewed feature gate; retain old Worker only until parity is measured. Audit non-ESPN fallback and verified ESPN/FD source policy.
3. Consolidate and test owner-approved background ingestion/scheduler, event dedupe, match versions and social outbox without duplicate writers; verify quota/cost limits.
4. Verify all Media/Predict boundaries, Stream.io studio, rights expiry, external media, AdSense and cutover acceptance with owner approval.
5. Do not change production DNS, billing, old Worker, cron-job.org, provider credentials or launch ads.

No production changes were made.
