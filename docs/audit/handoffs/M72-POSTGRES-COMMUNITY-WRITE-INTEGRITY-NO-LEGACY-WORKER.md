# M72 — Community write integrity and strict no-legacy-Worker V2 boundary

> **2026-11-16 supersession:** [M73](M73-ACCOUNT-FREE-MEDIA-CHAT-MOTM-POSTGRES.md) records the owner's updated rule: **Media visitors chat and vote without accounts**. The registered-fan identity requirement and disabled-forever posting assumptions below are historical M72 design notes. Anonymous signed visitor cookies, PostgreSQL-only constraints and Turnstile replace that requirement; source remains feature-gated until isolated staging verification.


Date: 2026-11-16
Branch: `refactor/factsport-v2`
Status: source and tests committed, no PostgreSQL migration applied, no public community writes or V2 fast-reader activation.

## Governing decisions

Factsport Media is the main public platform; match chat and MOTM are Media community services, not Prediction VIP. The owner supplied original external chat D1 and fast ESPN + MOTM D1 Worker source in M70, archived byte-for-byte as **non-executable** reference artifacts. The explicit owner requirement is **no active D1 in V2**: no new D1 bindings, D1 access, copied legacy D1 endpoints, or implicit dependence on the old external Worker deployment.

## Identity audit: why posting remains closed

`app/components/AuthProvider.tsx` still obtains fan `user.id` and profile details from **legacy Supabase client auth**. In contrast, Media editorial Entra sessions are authenticated through `readFactsportEntraSession` and a restricted editorial Postgres identity, and are not a substitute for a migrated general fan identity. Legacy chat Worker trusted browser-submitted user ID, username and avatar; legacy MOTM accepted duplicate/anonymous increments. These are not acceptable on V2. `POST /api/media/chat/messages` and `POST /api/media/motm` remain HTTP 503, and frontend write controls remain disabled; do not describe posting/voting as implemented or active.

## Changes

1. Migration `0045_factsport_media_community_write_integrity.sql` adds PostgreSQL **BEFORE INSERT** triggers on the private tables created in M70's migration 0044, with no new write privileges:
   - Chat: database-set creation timestamp; nonempty, bounded display name/message; prohibit arbitrary URLs and reserved announcement/reply markup; require canonical match; close at FT and after four hours; reject replies to hidden/other-match messages; per-author PostgreSQL transaction advisory lock and three-second rate limit across matches.
   - MOTM: database-set timestamp; validated candidate name; match kickoff through +24 hours; match's canonical `lineups.home/away` JSONB arrays; candidate must match a recorded `is_starter=true` player. M70's unique `(match_id, voter_user_id)` remains the concurrency-safe duplicate gate.
   - These rules are defense in depth, **not identity verification**. An eventual dedicated fan API role must receive narrowly scoped insert privileges and derive the internal user ID from an authenticated V2 session. SQL privileges/moderation audit are independent acceptance gates.
2. `FanZoneChat.tsx` no longer submits browser `user_id`, `username` or `avatar_url` in POST JSON. It checks HTTP success and removes failed optimistic messages, restores draft text and displays an accessible error; posting remains disabled.
3. `MOTMVoteWidget.tsx` now checks HTTP status before marking a vote successful or writing to localStorage; it displays rejection errors and retains disabled voting. localStorage is never server-authorized eligibility.
4. Added `tests/media-community-integrity.test.cjs` for SQL guards, no grants/D1, and client failure behavior. Added `tests/sql/media-community-write-integrity-acceptance.sql`: **rollback-only isolated staging** data cases for valid chat/vote, duplicate/rate limit, URLs, replies, finished matches, roster eligibility and expired vote. It has not been executed against PostgreSQL.
5. Removed the implicit legacy `live-api.factsport.com` Worker fallback from the **V2** shared fast match fetcher. `NEXT_PUBLIC_FACTSPORT_FAST_LIVE_BACKEND=postgres` must be explicitly selected, and the canonical-ID V2 reader must also be enabled server side. Without activation, the browser does not contact the old Worker and retains its initial canonical match snapshot. This is an explicit staged feature-gap tradeoff, not yet a fully activated 3-second live refresh.
6. `app/match/[id]/page.tsx` SEO metadata no longer fetches the old external Worker directly. Metadata uses the saved canonical match scores; null/unknown scores display as unknown rather than invented 0. The rich current-score metadata enhancement needs a separately verified internal short-cache fast projection.
7. Updated M71 and M68 regression assertions to check the old host only in archived/reference docs, **not** active V2 browser or match metadata code.

Commits:
- `b70ea38e997bbfd8f5f9363d7944f1d4dea90251` — PostgreSQL trigger migration
- `9ea15c0a3be5d5bc22c08c493b8370d2b3a2dcdb` — unambiguous JSONB alias
- `e98a4c19ee332a5d0a33bf313de0513b50032da7` — chat reject/identity behavior
- `4d21d16235bd47c8e4de0a7cc45f18cc51a7f1e7` — MOTM HTTP rejection behavior
- `afddaedf0ec264f7e6e34421138c22a87c78c96d` — integrity source tests
- `d1433cdc51da0f3c4283d197af12f19115c4aa39`, `18e6d181ac46e575a1cdf45319a88cf5b0dd49f5` — rollback-only staging acceptance SQL
- `3987b30b3897caf115beda1fa42a87f3c5bfa4a4` — remove implicit old-worker frontend fallback
- `8ec09d8a4d0292318386f1988933ec11cee4f711` — fast reader regression change
- `62b2aab0ea79fa2b0c40d0c3dbf6e9030b5c18e8`, `d39bc534c437465e2d19d564930233927f62ed02` — match-page metadata no old Worker and unknown score fix
- `dfc853e3963153591590bb2cd1bd57be450f897b` — match metadata test
- `a940eb9376abe89d486d23dff4be8b2d0e26adf9` — M68 test reconciliation

## Limitations and acceptance gates

- No actual PostgreSQL migration/trigger test has run. The staging acceptance SQL must be reviewed and run **only in an isolated V2 database** under authorized admin, with independent role/privilege audit and audit of schema changes from migrations 0001–0044. Running transaction tests against production is expressly forbidden.
- Trigger rules do not themselves authenticate a fan. Identity migration and scoped server-side author/voter mapping must be implemented before enabling POST. Existing Supabase-authenticated fan profile names, reply formatting, moderator pins and system announcements need role-aware Media replacements, not direct DB writes from browser sessions.
- Match status and kickoff plus 24-hour MOTM rule may be stricter than legacy pre-kick voting. Confirm product rules with owner/release acceptance; do not silently restore anonymous D1 increments.
- The extracted M71 fast ESPN code is staged behind flags. Removing the default legacy host avoids any V2 dependency on the old D1-capable Worker, but means **fast V2 client refresh remains inactive by default**. Verify canonical IDs, parser parity, CDN cache/ESPN quota/concurrency before activating staged fast reads.
- Current /live coarse-score reader and match chat/MOTM reader endpoints still require database migrations/flags. No cutover is complete, no full Node test suite, TypeScript check, Vinext build, connected Postgres or Cloudflare browser staging verification is claimed.
- No production database, D1, DNS, Cloudflare cron, existing external Worker, Stream.io room, advertising, billing, provider keys or deploy was changed.

## Next

Implement verified Media fan identity (separate from editorial roles and Prediction VIP), a narrow dedicated PostgreSQL community writer identity plus moderated/rate-limited POST routes, server-validated MOTM candidates and duplicates, secure chat replies/pins, and real browser/staging acceptance. Also finish the gated same-origin 3-second ESPN reader cache/load test and downstream Media/social/Prediction cutover parity without activating D1.
