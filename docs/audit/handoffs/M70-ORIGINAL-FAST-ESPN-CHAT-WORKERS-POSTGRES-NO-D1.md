# M70 — Owner-uploaded original fast ESPN/MOTM and chat Workers recovered; no active D1 in V2

Date: 2026-11-16
Branch: `refactor/factsport-v2`
Status: both original Worker source files archived and byte-for-byte matched against the supplied uploads; PostgreSQL-only Media community foundation committed; full runtime parity, deployment, writes, authentication and Cloudflare staging **not** verified.

## Supersedes M69's missing-source conclusion

On 2026-11-16, the owner provided the complete original Worker files `workerchatfs` and `workerfse`. We directly read those uploads (not inferred summaries), scanned for obvious hardcoded secrets, ran the JavaScript syntax checker, committed their **exact unchanged contents** into a non-executable legacy-source directory, and re-fetched both from the V2 branch to verify equality.

- `docs/audit/legacy-source/external-chat-d1-worker-v1.js.txt`
  - Original 2507 UTF-8 bytes, SHA-256: `fe34202411f24eb4acaa18eed8875ea5849fefdf09a537de80e769ea647b70d1`
  - GitHub archive commit `df0dcc7a4c1940a0a5c3d5e151d0bd3185b0f4ff`
- `docs/audit/legacy-source/external-fast-espn-motm-d1-worker-v1.js.txt`
  - Original 17742 UTF-8 bytes, SHA-256: `591825b4bf374703d0e32580e55eb2c6d19dac9f0238f3689f7037744dbb9c53`
  - GitHub archive commit `9d05cfc9de529b57a95f9cae51ac3ac505aa3407`

These are **reference-only .js.txt files** under docs/audit, not Wrangler entrypoints or code imported by V2. Do not execute, provision D1 databases for, or deploy the original scripts. Their code contains D1 `env.DB.prepare` accesses and legacy access-control weaknesses. The direct source scan found no obvious hardcoded API key or secret value, but cannot establish that deployed environment bindings/keys are secure.

## Original chat Worker behavior (verified in uploaded source)

- OPTIONS returns wildcard `Access-Control-Allow-Origin: *`.
- GET accepts `match_id` and **client-declared** `status`. It queries D1 `messages` ordered newest first, LIMIT 50, then reverses to oldest-first. Cache API TTL: 2s live, 60s scheduled/default and 3600s finished.
- POST accepts client-supplied `match_id`, `user_id`, `username`, `avatar_url` and `message`, generates a UUID, and inserts into D1 directly. **No server-verified auth, anti-spam/rate limit, bounds, or moderation** is enforced by the Worker. Legacy frontend restrictions are not server security.
- Cache key uses full client URL and status can alter shared-cache policy; writes do not invalidate cached reads.

## Original fast ESPN + MOTM Worker behavior (verified in uploaded source)

- The root GET accepts arbitrary `espn_id`, fetches ESPN soccer summary with a cache-busting query, and uses an edge Cache API cache key normalized to the ESPN ID.
- Maps upstream game state to `SCHEDULED`, `LIVE`, `HT`, `FT`, with commentary clock adjustments. Returns home/away score, display clock, team statistics (possession, corners, fouls, shots, penalties and half-time), lineups/formations, venue, referees, predictor percentages and commentary-derived events (goals, assists, cards, VAR, penalties, shots and substitutions). Exact mapping and order are in the archived source.
- Normalized TTL: live/HT ~3s, default/scheduled ~60s, FT ~3600s.
- Risky legacy behavior: missing scores become 0 through `parseInt(score) || 0`; most event IDs are `crypto.randomUUID()`, so events can change identity on uncached calls; no canonical match binding, upstream timeout, concurrency or quota budget is implemented.
- `GET /api/motm` reads D1 vote totals by `matchId`, cached 10s except finished client-declared status 3600s. `POST /api/motm` unconditionally upserts `player_name` vote counts into D1. There is no verified user uniqueness, match eligibility, roster validation or write throttling in the original Worker.

## Owner requirement: V2 must not use D1 actively

No D1 tables, Wrangler D1 bindings, external chat/MOTM D1 endpoints or active D1 code are approved for the V2 replacement. V2 uses the Mkety Core PostgreSQL/Hyperdrive reader and dedicated Media community authorization for future writes. Never treat the original D1 files as importable backend modules. Live ESPN viewer updates remain a separate same-origin read/cache responsibility and must not require D1.

### V2 implementation committed

1. Migration `db/migrations/0044_factsport_media_community_chat_motm.sql` creates private `media_match_chat_messages` and `media_match_motm_votes` tables and narrow public read views. Chat retains canonical match scope and 50-message history. MOTM enforces database uniqueness for `(match_id, voter_user_id)`. The views exclude private author/voter identifiers; hidden chat entries are excluded. Only the public reader receives SELECT on views; no new public write grants or D1 resources.
2. `lib/adapters/postgres-community.ts` uses `withFactsportPostgres`, validates canonical/legacy UUID match references, and reads only approved public views.
3. `GET /api/media/chat/messages` and `GET /api/media/motm` are same-origin and require `FACTSPORT_MEDIA_COMMUNITY_BACKEND=postgres`. The switch is **not** enabled by this change. When disabled/migration missing the endpoint returns a fail-closed error. POST intentionally returns HTTP 503 while authenticated write authorization is being built.
4. `FanZoneChat.tsx` and `MOTMVoteWidget.tsx` no longer call `chat-api.factsport.com` or `live-api.factsport.com/api/motm`. Both read from the new same-origin endpoints; they display a clear paused notice for unavailable writes instead of sending to D1. Legacy admin chat pin/announcement writes are also hidden behind the disabled community-write gate. The old Supabase admin pin action still exists in component source for later PostgreSQL Media admin migration and must not be reactivated.
5. Added `FACTSPORT_MEDIA_COMMUNITY_BACKEND` to Cloudflare environment types and `tests/media-community-no-d1.test.cjs` to verify archive SHA-256 identity, current client targets, no active D1 bindings, private PostgreSQL schema and disabled anonymous write routes.

Commits:
- `0d299309e4e8d22c339f3e231e80bb2333fe3c17` — PostgreSQL community schema
- `31ecf2e7f92d4c685bf7036e94e0746c16e511d6` — read adapters
- `155fa2d0c025dc5f7dcd6f2cdbc53aac1fae3160` — chat API reader
- `722cc08e31eb30df4ee4394b9d82f46a5e8c1425` — MOTM API reader
- `3b52137b45f2d8f1d68f727733972eaa7746f079` — chat client no D1 calls
- `a924667691e629199029844f44bb9508441e6d10` — MOTM client no D1 calls
- `2d4d7fbee273da9bd379811b133c694402d05be5` — Cloudflare backend typing
- `402ef2d3ce9ebc68a3e611c26846976807c46101` — regression tests

## Work still needed before claiming chat/MOTM parity or enabling writes

1. Apply migration 0044 **only** to isolated V2 staging Postgres after auditing existing migrations and role grants. Verify `factsport_v2_reader` sees views but cannot read user/voter table identity or write data. No D1 provision.
2. Introduce independent Media community PostgreSQL write role/connection and verify authenticated session mapped to V2 `app_users`; derive author/voter identity server-side, never from user-submitted `user_id`, username or avatar.
3. Add chat authorization/limits/rate control/moderation/replies, secure pin+announcement workflows, server-side URL filtering, message retention/anti-spam and real player status determination rather than trusting client `status`.
4. Add MOTM eligibility, vetted player candidates from canonical lineups, kickoff/end window, verified voter identity and one-vote-per-user transactional insert with explicit duplicate response. Do not trust localStorage as security.
5. Build and measure same-origin 3-second fast ESPN summary reader using **exact uploaded worker mapping as reference**, fixing missing-score zeroing and unstable event IDs, with canonical match ID and stale/error metadata. Keep the scheduled DB updater and social outbox separate.
6. Test chat scrolling, event feed, 3s/60s polling, user messaging and moderation; test MOTM totals, invalid/repeated vote, eligibility and result cache; measure database load and CDN caching.
7. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext`, full isolated database and protected Cloudflare staging. No full test/build or live provider validation has been performed in this session.
8. Do not modify production D1 databases, cron, DNS, credentials, live Worker, Stream.io, ad settings or billed Cloudflare products without explicit approval.

The new migration and endpoints are **branch source only**. No actual PostgreSQL migration, D1 operation, deployment, live room or production cutover was performed.
