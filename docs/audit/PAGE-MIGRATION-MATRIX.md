# Factsport v2 page and product-surface migration matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`  
**Scope:** App Router pages/layouts and the primary product journeys.

The v2 Worker currently proves only the protected health and matches read path. These page routes still contain Supabase client/server dependencies or are coupled to legacy features. They must be ported to the v2 domain services before cutover. Static policy/help pages are content-only but still need SEO/accessibility checks.

## Page register

| Page / route | Current dependency found in source | v2 domain owner | Production acceptance |
|---|---|---|---|
| `/` | Supabase `news`, `matches`; headlines, ticker, latest news, highlights, ads | Public home/read models + editorial | Same hero/headlines/news ticker/live results, SEO/metadata, mobile parity, cache rules, no Supabase runtime |
| `/matches` | Supabase `matches`, client list view, team form/aliases | Match list service | Stable compound cursor, canonical IDs, live/scheduled/finished filters, search, cache correctness |
| `/match/[id]` | Supabase `matches`, `site_settings`, player and match-detail components | Match center domain + MediaStore | Complete match details, lineups, events, stats, h2h, video/player entitlements, 3s live refresh, no provider-ID drift |
| `/news` | Supabase `news`, news artwork and ad components | Editorial/CMS read model | Published-only content, SEO, pagination, safe image rendering, provenance/attribution |
| `/news/[slug]` | Supabase `news`, related `matches`, MarkdownRenderer | Editorial/CMS | Preserve reviewed authored content, body/content semantics, stable slug, revisions, canonical metadata, source links |
| `/highlights` | Supabase `matches`, video/highlight links | Highlights/media | Verified video metadata, rights/provenance, safe embed, match association and fallback |
| `/live` | Supabase `matches`, `global_studio`, FactSportMediaRoom, FanZoneChat, LiveMediaClient | Live hub + community + studio config | Live state, chat moderation, stream config, MOTM/interactive widgets, rate limits and 3s freshness |
| `/standings` | Supabase `standings`, `matches`, LeagueLeaders | Competition/standings domain | Season/group aware, deterministic order, source freshness, correct tie-breaks |
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
