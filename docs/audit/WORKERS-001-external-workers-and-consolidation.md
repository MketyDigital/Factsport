# WORKERS-001 — External Cloudflare Workers, cron and frontend data paths
Date: 2026-10-30 | Status: USER-PROVIDED SOURCE + REPOSITORY SOURCE VERIFIED, NOT RUNTIME VERIFIED.
Deployment target: one managed Factsport 2.0 Cloudflare Workers/vinext application, modular APIs, one scheduled dispatcher; Mkety Core PostgreSQL; preserve feature parity. No production writes.

## Important provenance and security
Owner supplied three **external Worker definitions** in conversation:
1. a scheduled `fetch` orchestrator for /api/sync-fd and /api/settle;
2. a chat `fetch` Worker using `env.DB` (D1);
3. a live ESPN proxy + MOTM `fetch` Worker (submitted as an uploaded text file), using ESPN summary endpoint, Cache API and D1 MOTM votes.

Owner separately confirmed an external cron-job service calls **/api/live every 1 minute** for background DB updates, but frontend live feed is powered by the external Worker. Source snippets do not establish each Worker's own deployed cron schedule, binding configs, HTTP routes, D1 schema, or account access.
**SECURITY: submitted scheduled Worker contains a hardcoded fallback value for CRON_KEY. Do not reproduce its value, reuse it, or commit it. Rotate the current key before cutover and remove fallback/default secrets.** Old GET ?key= query strings are leak-prone; use secret bindings and internal scheduled handlers/service calls with no public write endpoints.

## Correct data flow, verified in source
1. football-data.org is primary fixture/competition ingestion for free-tier coverage (`scripts/sync-gh.js`); ESPN cup import fills provider gaps (`scripts/fetch-espn-cups.js`); matchmaker links ESPN IDs for FD-origin fixtures.
2. **Frontend LIVE path**: `app/providers/MatchLiveProvider.tsx` uses `app/utils/liveFetcher.ts` to request `https://live-api.factsport.com/?espn_id=...` when ESPN linked, every 3 seconds for live, every 60s otherwise, using `useSmartInterval` (exact helper behavior unverified). `app/match/[id]/page.tsx` also reads external live API server-side for live matched games. Worker polls ESPN summary and sends condensed score/status/clock, player/team stats, lineups, commentary-derived events, venue/referee and predictions; response live caching approx 3s, scheduled 60s, finished 3600s. `app/api/live/route.ts` is *not* this realtime frontend path.
3. **DB/background LIVE path**: user-confirmed external cron-job calls /api/live each minute, syncing ESPN-linked matches into Supabase matches, firing social notification attempts. It uses module-level `Map` (not persistent durable dedupe) and an unawaited outbound social fetch. Delayed cron/DB errors should not be misclassified as ESPN upstream outage.
4. **Five-minute jobs**: external Cloudflare scheduled Worker calculates `new Date().getMinutes() % 5===0`, then requests /api/sync-fd and /api/settle, with 30s request timeout. Its two tasks run concurrently apart from a 2-second settle delay; this does **not** guarantee FD sync has committed before settlement. Both tasks catch errors locally; top-level Promise.all can finish without a meaningful job-failure status. Source snippet's fallback key must be revoked/replaced.
5. **Chat**: `app/components/FanZoneChat.tsx` calls `https://chat-api.factsport.com/messages?match_id=...&status=...`, polling every 3s for live, 60s otherwise. Worker reads last 50 messages from D1 `messages`, reverses to oldest-first, and caches based on client-provided status (live 2s, scheduled 60s, finished 3600s). POST inserts client-submitted `match_id,user_id,username,avatar_url,message`, responds with UUID; **no authoritative token validation or server-side rate limiting in supplied Worker**, so client-side login/cooldown checks cannot prevent spoofing, abuse or spam. CORS wildcard means any origin may call; CORS is not authentication. Query parameter status is untrusted and can vary cache keys.
6. **MOTM**: `app/components/MOTMVoteWidget.tsx` calls `https://live-api.factsport.com/api/motm`. Worker reads D1 `motm_votes` grouped by `match_id`, returns player_name/votes; POST increments votes via upsert on `(match_id,player_name)`, **without login, per-user uniqueness or vote-window verification** in supplied source. Frontend `localStorage` flag is only a UI convenience and is trivially bypassed; server-side eligibility/candidate verification needed. Client-supplied status also controls 10s/3600s GET cache.
7. **ESPN proxy**: Worker allows origins `*`, accepts client-supplied ESPN ID, cache key ignores cache-busting query params but directly uses full ESPN summary fetch with `?_=${Date.now()}`; ESPN state maps to LIVE/FT/HT and parses commentary; cache expiration is based on returned status. Most event IDs are random UUID per uncached response: cannot rely on them for stable dedupe. Parsing scores with `parseInt(value)||0` conflates missing/invalid data with 0–0 and may cause false scores. The GET path has no documented throttle, max concurrency or provider timeout. Protect ESPN upstream under rate limiting/concurrency limits and cache fail-open policy.
8. **No ESPN ID case**: frontend `liveFetcher.ts` uses ESPN ID; for unmatched FD fixtures, website still needs up-to-date fallback via stored DB match endpoint (`app/api/match-data` or the integrated live GET). This requires explicit UI parity verification; do not assume ESPN can deliver those events.

## Recommended one-central-system layout (v2)
**One vinext Cloudflare Worker deployment, with separate internal modules/route handlers—not independent externally maintained Workers, not one global stateful job.**

- Public same-origin `/api/live/matches/:matchId`: fast ESPN proxy/live payload for verified ESPN-linked matches, 2–3s edge cache while live; never route each viewer poll through PostgreSQL. Cache by canonical match ID/ESPN ID, not arbitrary user query. If unmatched or outage fallback, serve last verified FD snapshot with `source`, `observedAt`, `stale` metadata and appropriate TTL. The match source must be bound to the trusted canonical ID.
- Scheduled `scheduled()` dispatcher: Cloudflare cron `* * * * *` for maintenance updates as needed; gate FD reconciliation, settlement and standings refresh at 5-minute intervals or separate cron expressions. Call shared internal functions, not public HTTP endpoints or ?key= URLs. Use one durable per-job lock/idempotency key (period + job), recorded outcome and retry semantics, and await critical ordering **sync FT -> finalize/validate -> settle**. A scheduler tick is not itself an ESPN health signal.
- Background `sync` module: main FD fixture ingestion at appropriate lower cadence, ESPN gap fixture bootstrap, ID matchmaker, ESPN linked DB snapshots and social outbox. Respect free-tier request budgets. Keep rich frontend updates independent of DB write frequency.
- `/api/chat/:matchId`: authenticate users on server, derive user ID/name/avatar from session, validate match access, message size, sanitation and rate limits, moderate links/spam, cursor pagination, no writable cached GET, and allow admin moderation. **Simplest starting point:** Mkety Core PostgreSQL `match_messages` plus same-origin API with 2–3s live polling; consider a Durable Object/WebSocket only after observed scale proves polling insufficient. Avoid retaining D1 merely because the old Worker used it; migrate chat data only if owner approves/retention obligations demand it.
- `/api/motm/:matchId`: read totals from PostgreSQL; POST under verified user/session and eligible match, validate candidate against verified team roster, unique(match_id,user_id) vote or owner-approved vote rules, one active vote/window, database atomicity and rate limits. No client-only enforcement.
- Internal `source-health` decision: ESPN upstream failure vs own worker/scheduler/network/DB/matcher issues distinguished using independent probes. Only verified upstream outage with healthy local processing permits temporary FD live fallback for ESPN-linked match. Immediate valid ESPN recovery restores preference; avoid overwriting more recent fallback data. See `SPORTS-002`. UI cache misses and stale DB are NOT ESPN outages.
- Existing `app/api/settle/route.ts` is not atomically idempotent; rebuild settlement in one DB transaction with processed-match/score version safeguards. Settler must not run on ABD/cancelled results.
- Apply structured logs (not response bodies containing user data), trace IDs, provider provenance, request quotas, error budgets, rate limiting, cache policies, and privacy-safe observability.
- Keep frontend endpoints same-origin; no CORS wildcard necessary for browser app unless verified cross-origin consumers need it.
- One central deployment may still use separate Cloudflare bindings (Postgres/Hyperdrive, cache, queues/R2) when justified. Central **ownership/config/observability** is the goal, not collapsing distinct live, chat, vote and jobs into a single bottleneck.

## Suggested deployment mapping
| Current | Target v2 | Data path |
|---|---|---|
| External live-api Worker | same-origin fast match-live proxy route | ESPN -> short edge cache -> frontend; FD fallback snapshot when appropriate |
| External /api/motm | same-origin authenticated MOTM route | PostgreSQL vote records |
| External chat-api Worker /messages | same-origin chat API | PostgreSQL messages; later DO if required |
| External five-minute scheduled Worker | Cloudflare Workers scheduled dispatcher | internal FD sync then verified settle |
| Cron-job.org /api/live each minute | same scheduled dispatcher | DB snapshots, notifications; **not** frontend live |
| GitHub Actions schedules / pg_cron | reviewed/selected Cloudflare schedules | no parallel production writers; dev runner only |

## Stage gates and unresolved facts
- Exact **configured** trigger expressions for external Worker(s), D1 schema/migrations, retention/storage costs, live API worker custom-route bindings, and external cron-job scheduling need owner dashboard confirmation; do not guess from code alone.
- Determine whether existing chat history and MOTM votes must be preserved. User opted for clean operational reset, but chat may carry personal data; decide retention and privacy explicitly.
- Need to verify external frontend use of additional Worker endpoints or any Stream/real-time connections.
- Run a local/staging load test to compare 3s polling and short caching; limit cross-origin requests, match IDs, quotas and edge cache misses.
- Never copy pasted raw Worker code containing apparent shared secrets into public repository. Note the required rotation privately, without echoing secret value.
- No code deployed, no database changed and no production Worker modified by this audit.
