# Factsport v2 page and product-surface migration matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`  
**Scope:** App Router pages/layouts and the primary product journeys.

The v2 Worker currently proves only the protected health and matches read path. These page routes still contain Supabase client/server dependencies or are coupled to legacy features. They must be ported to the v2 domain services before cutover. Static policy/help pages are content-only but still need SEO/accessibility checks.

## Page register

| Page / route | Current dependency found in source | v2 domain owner | Production acceptance |
|---|---|---|---|
| `/` | Opt-in PostgreSQL paths now cover published news, match window, featured matches, rights-reviewed homepage highlights, mini standings and a safe featured-match setting API. Supabase fallbacks remain when flags are unset; public affiliate config and `pro_analysis`/Bet of the Day still lack V2 public read models. | Public home/read models + editorial + match service | Apply/stage-test 0004-0006; preserve Bet of the Day and public settings; verify 3s live UX, empty states, no secret settings, SEO/mobile/cache parity; remove fallbacks only after full parity |
| `/matches` | Staging v2 path now reads initial matches and team form through the read-only PostgreSQL Hyperdrive; legacy Supabase fallback remains when backend flag is unset. Client live polling still calls the external `live-api.factsport.com` endpoint. | Match list service + fast live proxy | Staging initial SSR and load-more reads verified; stable `(match_date,id)` cursor; canonical IDs, team aliases, live/scheduled/finished filters, 3-second live UX, cache correctness and eventual same-origin live proxy migration |
| `/match/[id]` | Supabase `matches`, `site_settings`, player and match-detail components | Match center domain + MediaStore | Complete match details, lineups, events, stats, h2h, video/player entitlements, 3s live refresh, no provider-ID drift |
| `/news` | Explicit PostgreSQL read path through human-reviewed `public_editorial_articles`; Supabase remains the fallback when `FACTSPORT_EDITORIAL_BACKEND` is unset. | Editorial/CMS read model | Apply and stage-test migrations 0004-0005; preserve SEO/pagination, test empty pages/category filters, verify original content and provenance before import, retire fallback only after parity |
| `/news/[slug]` | Explicit PostgreSQL approved-article path; SEO title/description/canonical and original author fields are projected; related fixtures can use PostgreSQL. Raw HTML is sanitized and iframe embeds are allowlisted. Supabase fallback remains. | Editorial/CMS + match service | Apply/stage-test 0004-0005; verify safe Markdown/embed rendering, JSON-LD escaping, canonical URLs, source links, legacy body/content preservation and article/sidebar parity |
| `/highlights` | Full page now has an opt-in PostgreSQL paginated reader for `public_match_highlights`, dynamic league filters, verified canonical source links and rights-cleared R2 thumbnails; legacy Supabase fallback remains. | Highlights/media | Apply 0004-0006; verify external video source and thumbnail rights in staging, pagination/empty states, media expiry, and match-centre deep links; ingestion/admin rights workflow remains open |
| `/live` | Supabase `matches`, `global_studio`, FactSportMediaRoom, FanZoneChat, LiveMediaClient | Live hub + community + studio config | Live state, chat moderation, stream config, MOTM/interactive widgets, rate limits and 3s freshness |
| `/standings` | Full table now has an opt-in PostgreSQL path through season/group-aware `public_competition_standings`; form uses same-season final results; `LeagueLeaders` uses `/api/standings/leaders` backed by `public_competition_player_stats`. Legacy fallbacks remain. | Competition/standings domain | Apply 0006-0007; verify provider ingestion, tie-breaks, current-season uniqueness, player stat reconciliation, freshness and live refresh; migrate `/tournaments` next |
| `/tournaments` | Supabase `matches`, LeagueMatchGroup, LiveStandings, LeagueLeaders | Competition catalogue | Competition metadata, fixtures/results/standings, pagination, cup/group support |
| `/tournaments/[league]` | Supabase `matches`, league widgets | Competition detail | League/season routing, group tables, fixtures, match links, not-found handling |
| `/leaderboard` | Supabase `site_settings`, `profiles`, `campaigns`, `monthly_winners` | Prediction/rewards read models | Ranking/period semantics, public-safe user data, VIP labels, approved winners only, no leaked personal fields |
| `/dashboard` | Supabase server session; `profiles`, `site_settings`, `user_predictions`, `campaign_leaderboards`, `monthly_winners` | Identity + prediction/account domain | Verified user session, prediction history, points/eligibility, campaign state, privacy controls |
| `/dashboard/settings` | Supabase client, `profiles` | Profile/account service | Server-validated profile updates, email/session consistency, CSRF and audit |
| `/login` | Supabase browser auth, Cloudflare Turnstile | OIDC/Auth adapter | Authorization Code + PKCE, state/nonce, anti-bot, secure cookies, errors/recovery, no client secret |
| `/register` | Supabase browser auth, Turnstile, profile metadata | OIDC/Auth adapter + onboarding | Provider signup, immutable Factsport user ID, verified email, duplicate identity handling, consent |
| `/forgot-password` | Supabase browser auth, Turnstile | OIDC/Auth adapter | Provider recovery flow, anti-enumeration, rate limits and safe return URLs |
| `/auth/update-password` | Supabase browser auth | OIDC/Auth adapter | Provider callback validation, session assurance, CSRF and password reset confirmation |
| `/vip/upgrade` | Supabase client, `site_settings`, `profiles`, `subscriptions`, `payment_proofs`; browser image compression | Entitlements/payments | Verified provider/sandbox/manual payment, durable entitlement ledger, evidence retention, webhook reconciliation, idempotent upgrade/expiry |
| `/admin` | Supabase session and `subscriptions`; many management widgets | Admin control plane | Server-side RBAC, step-up, admin audit, operational overview, least privilege |
| `/admin/layout` | Supabase `profiles`, unsigned vault cookie | Admin RBAC + step-up | Every route/action protected server-side; signed/session-bound step-up; expiry/revocation |
| `/admin/matches` | Supabase client, `campaigns`, `matches` | Sports operations console | Fixture corrections, source mappings, safe edits, optimistic concurrency, audit log |
| `/admin/news` | Supabase client, `matches`, `news` | CMS/editorial console | Draft/review/publish, source provenance, revision/rollback, rights metadata, roles |
| `/admin/studio` | Supabase server, `global_studio`, StudioClient | Live studio settings | RBAC, validated stream settings, encrypted secrets, change audit, safe defaults |
| `/admin/users` | Supabase server/admin clients, `profiles` | Identity/entitlement admin | User search, support actions, VIP entitlement ledger, step-up and audit |
| `/embed/[id]` | Supabase matches/site settings, EmbedPlayerClient | Match/video embed service | Public-safe match data, origin allowlist, signed stream entitlement, CSP, no secret leakage |
| `/how-to-play` | Supabase server `site_settings`, `campaigns` | Rules/content service | Rules match actual prediction/eligibility/points implementation; versioned campaign display |
| `/disclaimer` | Static | Legal content | Owner-reviewed legal copy, correct affiliate/sports-prediction disclaimers |
| `/privacy-policy` | Static | Privacy/compliance | Accurate data processors, retention, cookies, analytics, rights and contact |
| `/terms` | Static | Legal content | Accurate service, account, VIP/payment, prize and dispute terms |
| `/error`, `/not-found` | Static UI | Platform UX | Safe error IDs, no internal errors/secrets, accessible recovery and correct HTTP status |

## Shared shell and components

- `app/layout.tsx`: AuthProvider, SiteHeader, Footer, sticky affiliate/ad surfaces and global media provider. Rebuild providers against v2 auth/config without importing Supabase clients.
- Shared public components include headline/news ticker/list, match cards/widgets, standings, player/video, highlights, leaderboard, ads, affiliate banners, install banner, share and Markdown rendering.
- Shared interactive components include FanZoneChat, MOTM, match pin, player/stream, prediction entry, VIP payment proof, dashboard history and admin management widgets. Each needs an API/service contract and server authorization; client state is never an authority.
- Every component that directly imports `@supabase/supabase-js` or `app/lib/supabase/client` remains a legacy dependency even if its page itself only imports the component.

## Required page parity journeys

1. Anonymous visitor: home → news list/article → league/tournament → match center → standings/highlights.
2. New user: register → verify identity → login → profile/dashboard → prediction entry → view leaderboard.
3. Returning user: session refresh/logout/recovery, prediction history, privacy and account settings.
4. VIP user: purchase/proof → verification → entitlement activation → expiry/renewal; webhook replay must not double-grant.
5. Editor: draft article → attach source/media → review → publish → revise/unpublish → SEO/indexing.
6. Sports operator: inspect fixtures → review ESPN link → monitor live state → verify FT → approve settlement → reconcile leaderboard.
7. Admin/support: MFA/step-up → role-limited operations → audited changes → session revoke.
8. Community: authenticated chat, moderation, MOTM voting, match pin and video entitlement.
9. Mobile/PWA: responsive navigation, offline/install experience, notifications and accessible controls.

## Completion rule

A page is not complete merely because it renders. It must be exercised with real v2 adapters, role-correct test identities, staging database records, external integration sandboxes, mobile/browser coverage, provider failures and rollback. The route/API mapping is in [ROUTE-MIGRATION-MATRIX.md](./ROUTE-MIGRATION-MATRIX.md).


## 2026-11-07 implementation checkpoint — editorial V2 vertical slice

- Added `db/migrations/0004_factsport_editorial_media.sql`: empty editorial article, revision, source-provenance, and R2 media metadata structures. It creates published-only read views and exposes only those views to `factsport_v2_reader`; drafts and rights-pending/expired media are excluded.
- Added `lib/adapters/postgres-editorial.ts` for bounded published article listing, slug lookup, and rights-cleared media metadata lookup.
- Added `app/api/media/[...key]/route.ts` to serve only approved raster images whose object keys exist in the public-media view. SVG and unapproved media are not served by this route.
- Added explicit, opt-in PostgreSQL paths to the homepage editorial feed, homepage match window, news listing, and article body/related fixtures. Existing Supabase fallbacks remain in place; featured-match/highlight reads and the rest of the platform are not yet migrated.
- Added schema/read-path regression tests and extended `.github/workflows/v2-verify.yml` path coverage plus migration inventory checks.
- **Not applied to Azure PostgreSQL and not deployed.** The existing generated bootstrap intentionally bundles only migration 0001; migration 0004 requires its own reviewed staging migration execution and post-migration verification. No content or media rows were imported.
- Status: implementation committed to `refactor/factsport-v2`; CI and runtime verification pending. Production remains untouched.


## 2026-11-07 implementation checkpoint — editorial hardening and homepage read models

- Added migration 0005 to record article origin (\`manual\`, \`ai_assisted\`, \`automated\`, \`imported\`, \`unknown\`), preserve legacy body/content fields and original creation time, carry SEO/reverification metadata, and require an identified human reviewer before an article can publish. Public article view now filters for approved human-reviewed content; public media requires a recorded rights review.
- Added migration 0006 for featured-match flags, a narrowly projected homepage settings view, season/group-aware competition standings, and provider-locked YouTube/Vimeo highlight records with human rights approval and optional rights-cleared R2 thumbnails.
- Match, editorial and homepage adapters use request-scoped PostgreSQL clients, closed after each operation; Hyperdrive manages pooled backend connections. This replaced the earlier module-scoped client after intermittent staging 503s.
- Homepage now has PostgreSQL read paths for featured matches and rights-cleared highlights; homepage mini standings can read the new season-aware standings view. \`HomeDashboardClient\` no longer reads Supabase directly; it obtains its featured-match setting from \`/api/settings\`, whose PostgreSQL branch exposes only the safe featured-match pointer.
- Article Markdown now passes through \`rehype-sanitize\`; only approved YouTube/Vimeo embed hosts survive. The existing match-widget token is preserved through a dedicated safe protocol. NewsArticle JSON-LD is escaped against script termination and metadata uses reviewed SEO/canonical fields.
- Remaining homepage gaps: public affiliate/config settings and the legacy Bet of the Day \`pro_analysis\` data model are not yet migrated. The full \`/highlights\` and \`/standings\` routes remain legacy-backed. No full page is marked complete.
- Migrations 0004-0006 are committed but **not applied** to Azure PostgreSQL. No legacy article bodies/media were copied, and no production resource or record was changed. Staging migration execution and data provenance review remain separate gates.


## 2026-11-07 competition read-path continuation

- Full \`/highlights\` listing now supports PostgreSQL pagination, league filters, verified source-video links and approved R2 thumbnails. The source links open the recorded canonical YouTube/Vimeo URL rather than assuming a V2 match ID exists in the legacy match-centre database.
- Full \`/standings\` table now reads season/group-aware standings and computes last-five form only from final scored matches in the selected season. The \`LeagueLeaders\` client no longer accesses Supabase directly; it calls \`GET /api/standings/leaders\`, which has a narrow public projection and a PostgreSQL player-stat reader.
- Migration 0006 now adds \`matches.season\` and a bounded completed-results index. Migration 0007 adds season-aware player goals/assists with a public-only view. Both are additive and unapplied.
- Remaining competition work: provider ingestion for standings/scorers, tie-break and freshness parity against real fixtures, full tournaments pages, cup/round metadata and match-centre integration. No data is fabricated or imported from legacy standings snapshots.


## Read-flag deployment contract

The base \`FACTSPORT_MATCHES_BACKEND\` flag must remain independent of migrations 0004-0007. Editorial, homepage, highlights and competition read paths use separate flags so a partially migrated staging database cannot accidentally query a view/column that is not yet installed.


## 2026-11-07 competition page continuation

- `/tournaments` now has a V2 directory implementation with known league destinations and optional current-season labels from the competition directory reader.
- `/tournaments/[league]` uses the bounded base matches PostgreSQL reader behind the base match flag; the legacy fallback remains.
- `LiveStandings` no longer queries Supabase from the browser. It reads same-origin competition-match and standings APIs and refreshes periodically.
- The full `/standings` and `/highlights` pages already have feature-flagged PostgreSQL read implementations, but provider population, staging data verification, full browser parity and operational freshness remain incomplete. No page is declared fully complete.
- Latest build and isolated verification are pending after corrections to a JSX template literal and promo regression test. Migrations 0004-0007 remain unapplied.

## 2026-11-07 verified competition/live-standings slice

- Native Vinext build passed on 37281e9d141b88f0e3f22409fb49d7b045a0956f (run 42382907761).
- Protected staging passed on that commit (run 42382907988): Worker build/deploy, deny-by-default, authorized /matches page render, stable timestamp+UUID pagination and authentication/cache isolation passed.
- The first authorized match API request returned a transient 503; the retry returned a populated result and pagination succeeded. Treat the cold-start/transient failure as an operational reliability item, not as an unqualified clean pass.
- Isolated verification passed on 1afe964c2d0a3a0d71655a4cc95334377a3c100e (run 42383032967), including the engine regression suite, TypeScript, prediction/consent schema contracts and migration inventory.
- Staging test coverage is still focused on the existing matches endpoint; the new tournament endpoints and feature-flagged standings reads need their own authenticated integration probes once the matching migrations and current-season data are provisioned.
- No migrations 0004-0007 were applied, no legacy data imported, and no production resources changed.

## 2026-11-07 Hyperdrive lifecycle correction — M11

- Intermittent staging 503s were investigated. The app had a module-scoped postgres.js client reused across Worker requests, and the match reader used sql.unsafe() for its dynamic projection. Both were removed: adapters now use a request-scoped client closed in finally, and static SELECT projections preserve prepared statements.
- Isolated verification passed on 3ed1df5 (run 42383870339); native Vinext build passed (run 42383870315).
- Protected staging passed (run 42383870331): deny-by-default, Hyperdrive/R2 health, /matches initial render, timestamp+UUID cursor pagination without duplicate row, and auth/cache isolation all passed. The pagination 503 did not reproduce after the lifecycle change.
- Continue monitoring transient database errors; a successful rerun is not a guarantee against future infrastructure failures.
- Main /match/[id] remains a legacy path until canonical legacy-ID crosswalk, prediction/campaign parity, server-authorized stream grants, VIP analysis RBAC, ticker and settings reads are complete. See M11.

## 2026-11-07 canonical/legacy match identity foundation

- Added migration 0008: nullable unique legacy Supabase UUID alias; V2 matches.id remains canonical and no existing foreign key is rewritten.
- Added a bounded reader that resolves canonical or legacy UUID and returns the canonical V2 ID.
- Added an independently gated /api/match/[id] PostgreSQL API path with a public projection that excludes stream URLs, audio/video links, pro_analysis, campaign IDs, affiliate URLs and settlement state.
- Migration 0008 is not applied and no aliases are populated. The main /match/[id] page remains on its legacy path pending approved ID reconciliation and stream/prediction/VIP parity.

## 2026-11-07 match-centre media and VIP access hardening — M12

- The legacy /match/[id] page remains Supabase-backed. Its match query is now an explicit column projection rather than select('*'); a safe client DTO is passed to MatchHeaderClient and MatchMobileHub, excluding raw video/live/audio URLs, pro_analysis, campaign identifiers and affiliate URLs.
- SecureMatchPlayer requests GET /api/match/[id]/playback. The server applies the existing 15-minute pre-kickoff lock and does not include playback URL fields in the locked response. After unlock it returns the selected video/audio source; the secondary audio source is preserved when a video source is also present. The existing streamio sentinel remains supported.
- ProBettingSlipLock no longer queries the browser Supabase client or receives pro_analysis in props. It requests GET /api/match/[id]/analysis; the server validates the session and checks the legacy profiles.is_vip flag before returning the analysis object.
- The match page now selects only the three announcement fields it uses from site_settings. The existing ticker, prediction board, affiliate widget and other legacy child journeys remain on their existing services; they have not been migrated by this slice.
- Verification on 45d5cd3b4a5fcd39ab33e1eb58bdf47ba40c5ecd: isolated verification passed (run 42385395641), native vinext build passed (run 42385395567), and protected staging passed (run 42385395586).
- The protected staging run validates the existing PostgreSQL-backed /matches path, pagination, deny-by-default access, Hyperdrive/R2 health and cache isolation. It does not exercise the new match-detail playback or VIP endpoints; those are source/test/build verified only.
- This is not match-centre PostgreSQL parity. Remaining blockers include legacy-ID alias population, campaign/prediction parity, V2 entitlement/RBAC integration, signed short-lived playback grant or controlled media proxy, ticker/settings migration, and end-to-end tests for stream unlock, audio/video, finished highlights, VIP/non-VIP and provider failures. No migration was applied and no production resource changed.

### M12 hardening follow-up — 2026-11-07

- Playback status handling now fails closed for unknown pre-kickoff statuses: only an explicit known-live status is treated as live; POSTPONED/CANCELLED/CANCELED returns unavailable rather than opening a stream. Time-based unlock remains available at/after the scheduled 15-minute threshold for other statuses.
- Relative media paths are kept same-origin instead of being rewritten to the production domain; protocol-relative paths, backslashes and path traversal are rejected. The existing streamio sentinel is preserved. Match-page metadata uses the same explicit live-status allowlist so an unknown status cannot expose a pre-kickoff stream URL through OpenGraph metadata.
- Final code head `ab3e924f29766f42ad35210ffd75e23892e58896`: isolated verification passed (run 42386252137; 104 engine tests and 5 ingestion tests), native vinext build passed (run 42386252158), and protected staging passed (run 42386252101).
- Staging continues to verify the protected `/matches` PostgreSQL path and infrastructure boundary only. It does not call `/match/[id]` or the new playback/VIP APIs; those remain source/test/build verified, not runtime verified.


## 2026-11-08 Media asset-library continuation

- Added `/admin/media` as a Media-role-protected asset library with search, rights-status filtering, pagination, metadata and authenticated private R2 previews. New uploads in the newsroom also show a private preview before rights approval.
- Added the matching role-protected `GET /api/admin/media` library endpoint and `GET /api/admin/media/[id]` private preview route. These are Media editorial writer operations, not public media delivery.
- `/admin/news` still uses the dedicated editorial Hyperdrive and fails closed if unavailable. The new asset library does the same.
- **Open login blocker:** `/admin` middleware still applies the legacy email allowlist, while `/admin/layout.tsx` redirects to `/login` and `/login/layout.tsx` is private-Prediction-host-gated. Entra External ID is the approved Day 1 identity provider but its tenant and adapter are not configured. Do not remove the old guard until a working Media-host identity flow and server-side RBAC are verified.
- Source tests, TypeScript and native vinext build passed on code commit `5a6f4a86e27b7d27c20eb2c73d21b3a3534d6957`; protected staging run `42461455140` passed unauthenticated denial, `/api/v2/health` (Hyperdrive/R2), PostgreSQL-backed `/matches`, `/api/matches` timestamp+UUID pagination, private/no-store and auth/cache isolation. The corrected guard commit `c8462017270b6f54e6633181f3c16b0797be2db6` then passed isolated verification `42463637375`, native Vinext build `42463637427` and a second protected staging run `42463637373` with the same runtime scope. Neither staging run applied migrations 0004–0026 or exercised CMS actions, editorial/media APIs, R2 upload/preview, writer grants or Entra login.