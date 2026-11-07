# M30 — AdSense-first public Media inventory and private Prediction separation

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: source changes committed; no AdSense script or ad units enabled; external account/site/CMP and live-domain verification remain open.

## Owner-approved product boundary

The public Factsport Media website is the AdSense-first editorial experience. Existing VIP, premium prediction, bookmaker affiliate, paid-prize and campaign functionality is retained as a separate private Prediction product. These features are not deleted or silently cancelled. Public Media pages, metadata, feeds, structured data, social distribution and public settings must not expose betting promotion or private Prediction business details.

## Public promotion removal

Removed legacy bookmaker banners, betting promo widgets and bonus-code placements from:
- Public news index and article detail.
- Live match hub.
- Public match centre, including the visible ScoreAxis bookmaker CTA and affiliate URL projection.
- Highlights, standings and tournament index/detail.
- Public header and footer VIP/prize navigation.
- Public homepage quick-link to the private VIP leaderboard; it now links to sports standings.

The AdsterraStandardBanner, BettingPromo and FreeTipsBanner components remain in source for private-product parity only. No public Media page should mount them. The old timed CustomVignette is not mounted in the public root layout.

## Private Prediction host boundary

- /vip/upgrade, /how-to-play and the legacy VIP/prize /leaderboard route now require the exact FACTSPORT_PRIVATE_PRODUCT_HOST configured on the private deployment. If unset or accessed from another hostname, the route returns not-found.
- These routes are noindex; crawler rules exclude them. Public Media navigation no longer links to them.
- Existing private page implementation and data/settlement behavior are retained; no production memberships, prizes, campaigns or payouts are altered.
- GET /api/settings now returns only the public Media homepage settings projection.
- Prediction affiliate settings are served from /api/prediction/settings only when the request host exactly matches the configured private product hostname. The response is private-cache scoped.
- FACTSPORT_PRIVATE_PRODUCT_HOST must be configured only on the approved private deployment. No DNS/host was invented or changed.

## Public social distribution boundary

Migration 0022:
- Restricts media_social_channels.surface_scope to public_media.
- Restricts media_social_publications.distribution_scope to public_media.
- Adds the identity and timestamp of the operator confirming a post is suitable for public Media distribution.
- Adds a database check requiring confirmation for scheduled, queued, publishing or published posts.

The Social composer requires an explicit attestation that the post contains no bookmaker/affiliate promotion, bonus code, wagering CTA, paid-prize inducement or private Prediction details. The server action checks the public channel scope and stores confirmation and audit data in the same transaction. The Prediction product must use a separate social service, channels and credentials; it cannot reuse the Media public channel table.

## Public publisher transparency

Added:
- /about
- /contact using existing verified public social accounts (no invented email or business address)
- /editorial-standards
- /advertising-policy

Updated the public Privacy Policy, Terms and Disclaimer to describe the public Media service separately from private products. Public footer links to the new transparency pages.

The privacy notice explicitly states that AdSense is not currently enabled and explains the future advertising/cookie/consent processing that must be disclosed before activation. The Advertising Policy describes the current absence of AdSense and the no-bookmaker-promotion public inventory rule.

## SEO and crawler readiness

- app/robots.ts remains deny-all unless indexing is explicitly enabled in production and the editorial, matches and sitemap backends are all set to PostgreSQL.
- It also excludes private/admin/auth/API/payment/chat/studio/embed/legacy private leaderboard/how-to-play routes.
- app/sitemap.ts no longer reads legacy Supabase. It fails closed unless the explicit indexing and V2 PostgreSQL backend flags are set, then builds static, public editorial and match URLs from V2 read adapters.
- Public About, Contact, Editorial Standards and Advertising Policy pages are in the sitemap only after the V2 sitemap gates are satisfied.
- public/ads.txt retains the existing Google seller line pub-6393486260333696; the line has not been verified against the current owner AdSense account or live root response.

## AdSense technical policy gate

Added lib/adsense-policy.ts as a fail-closed allowlist for a future ad slot:
- explicit feature flag;
- explicit site/account approval flag;
- explicit consent/CMP-ready flag;
- exact publisher ID format;
- exact public hostname;
- only public editorial homepage/news routes;
- no ads on match, live, prediction, leaderboard, account, payment, admin, chat, private or interactive surfaces.

This helper does not load Google's script or create ad units. No guessed publisher ID, slot ID or CMP integration was added. AdSense remains disabled until the owner verifies the account/site status, selects/configures an appropriate CMP for relevant traffic, verifies live ads.txt and approves the content/policy audit.

## Regression coverage

Added tests/adsense-readiness.test.cjs and updated existing monetization/settings tests to assert:
- no affiliate banners/bonus promos on public Media pages;
- private affiliate components remain in source for Prediction parity;
- public settings API cannot return Prediction affiliate links;
- private settings endpoint is host gated;
- VIP/prize routes are private host gated;
- public social scheduling is scope-limited and requires a content attestation;
- public indexing and sitemap are V2 PostgreSQL gated.

## Remaining acceptance blockers

1. Run the latest full CI (unit/regression, TypeScript, vinext build and staging compatibility); fix every failure.
2. Run a full repository-wide source/content/metadata/structured-data/feeds/API audit for bookmaker names, betting odds, affiliate domains, VIP prize inducements and hidden/unused promo callsites.
3. Verify https://factsport.com/ads.txt, robots.txt and sitemap.xml from the live public domain after deployment; compare the seller record to the actual owner account.
4. Confirm actual AdSense account ownership, site submission and Google's Ready status. No source change can certify approval.
5. Choose and configure a Google-certified CMP integrated with IAB TCF for EEA/UK/Switzerland personalized-ad traffic; test reject/accept/withdrawal and consent signals. No custom home-grown CMP is substituted.
6. Complete privacy/legal review of controller identity, contact details, retention, cross-border processing, user-generated content, video embeds and all external data/media providers.
7. Complete editorial source/rights/provenance and moderation audits, original-content quality review and mobile/accessibility/Core Web Vitals review.
8. Verify the private host is provisioned separately and server-side access, auth, entitlements, payments, affiliate integrations, VIP and prize workflows still function on that host.
9. Apply migrations 0021 and 0022 only after role, dependency and staging DB verification. Do not apply migrations to production as part of this work.

No production DNS, Worker, Supabase data, Cloudflare route, AdSense account, publisher ID, CMP or ad serving configuration was changed. No ads are enabled.
