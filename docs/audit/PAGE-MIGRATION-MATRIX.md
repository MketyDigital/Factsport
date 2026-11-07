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
| `/highlights` | Full route remains Supabase-backed; homepage HighlightsSlider now has a PostgreSQL `public_match_highlights` path with reviewed rights, provider-locked YouTube/Vimeo URLs and optional R2 thumbnails. | Highlights/media | Port full route, add media ingestion/review/admin workflows, verify embed entitlements and rights expiry; migration 0006 is not applied |
| `/live` | Supabase `matches`, `global_studio`, FactSportMediaRoom, FanZoneChat, LiveMediaClient | Live hub + community + studio config | Live state, chat moderation, stream config, MOTM/interactive widgets, rate limits and 3s freshness |
| `/standings` | Full route and LeagueLeaders remain Supabase-backed; homepage MiniStandings has an opt-in season/group-aware PostgreSQL path through `public_competition_standings`. | Competition/standings domain | Port full route, leaders and live refresh; populate only from new provider ingestion and verify tie-breaks/freshness; migration 0006 is not applied |
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
- Added a shared one-connection-per-isolate PostgreSQL client used by match, editorial and homepage adapters.
- Homepage now has PostgreSQL read paths for featured matches and rights-cleared highlights; homepage mini standings can read the new season-aware standings view. \`HomeDashboardClient\` no longer reads Supabase directly; it obtains its featured-match setting from \`/api/settings\`, whose PostgreSQL branch exposes only the safe featured-match pointer.
- Article Markdown now passes through \`rehype-sanitize\`; only approved YouTube/Vimeo embed hosts survive. The existing match-widget token is preserved through a dedicated safe protocol. NewsArticle JSON-LD is escaped against script termination and metadata uses reviewed SEO/canonical fields.
- Remaining homepage gaps: public affiliate/config settings and the legacy Bet of the Day \`pro_analysis\` data model are not yet migrated. The full \`/highlights\` and \`/standings\` routes remain legacy-backed. No full page is marked complete.
- Migrations 0004-0006 are committed but **not applied** to Azure PostgreSQL. No legacy article bodies/media were copied, and no production resource or record was changed. Staging migration execution and data provenance review remain separate gates.
