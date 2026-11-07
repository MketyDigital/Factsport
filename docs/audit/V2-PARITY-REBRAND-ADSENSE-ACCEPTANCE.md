# Factsport V2 — feature parity, frontend rebrand and AdSense acceptance contract

**Branch:** `refactor/factsport-v2`  
**Created:** 2026-11-07  
**Status:** governing acceptance addendum; implementation and approval gates remain open.  
**Authority:** supplements `docs/audit/ROADMAP.md`, `PRODUCTION-EXECUTION-PLAN.md`, route/page/component/data migration matrices and milestone handoffs. It does not authorize production changes or silently supersede owner decisions.

## 1. Non-negotiable product-preservation rule

Factsport V2 is a complete modernization of the existing product, not a reduced replacement. Preserve every current feature, business rule, workflow, integration, API contract, page journey, admin capability, media behavior, monetization mechanism and useful edge case unless:
- the owner explicitly approves a change/removal; or
- a documented security, legal, platform or Google policy requirement makes the current behavior unsafe or ineligible, in which case propose a compliant equivalent and obtain approval for material product changes.

Do not infer that a feature is obsolete because it is absent from the current staging slice. Do not call a feature complete because its route compiles, a placeholder renders, a health endpoint returns 200, or a workflow is registered. Completion requires its data contract, authorization, UI journey, error/retry behavior, observability, tests and rollback.

The approved data rule is **fresh operational data; full product**:
- Recreate the complete schema, rules, jobs, integrations, workflows and capabilities.
- Start generated/transactional sports and gameplay history at zero.
- Preserve source database and backups; never destroy legacy data during development.
- Review identity, VIP/paid obligations, legal/prize records and authored editorial/media separately.
- Preserve original authored content and stable SEO slugs after provenance and rights review.

## 2. Governing plans and records reviewed

The V2 tracked documentation inventory was enumerated and reviewed, including:
- `docs/audit/ROADMAP.md`, `PRODUCTION-EXECUTION-PLAN.md`, `FULL-SYSTEM-2026-11-06.md`, `V2-REPOSITORY-AUDIT-2026-11-06.md`.
- `PAGE-MIGRATION-MATRIX.md`, `ROUTE-MIGRATION-MATRIX.md`, `COMPONENT-MIGRATION-MATRIX.md`, `DATA-MIGRATION-MATRIX.md`, `ROLE-PRIVILEGE-MATRIX.md`.
- DB/security: `DB-001`, `DB-002`, `DB-003`, `SEC-001`.
- Sports/media/operations: `SPORTS-001`, `SPORTS-002`, `WORKERS-001`, `MEDIA-001`, `CLOUD-001/002/003`.
- Identity/AI: `AUTH-002`, `AUTH-003`, `AUTH-004`, `AUTH-AI-001`.
- Implementation evidence: `CF-001`, `DB-001-first-slice`, `DB-002-hyperdrive-smoke`, `DB-003-restricted-runtime`, `ESPN-001/002/003`, `INGEST-001`, `RELEASE-001`, plus M00 and M06 handoffs.
- The source inventory and recent GitHub Actions evidence recorded in the full-system and repository audit.

This documentation review is not a claim that every application source file, external Cloudflare account object, Azure setting, private content record or live integration has already been audited. Those remain explicit verification work.

## 3. Frontend redesign / rebrand contract

### Preserve brand identity and recognizable assets

The redesign must modernize the presentation and information architecture without inventing a new brand or replacing current identity assets:
- Keep the existing Factsport wordmark/logo file `/logo.png`.
- Keep `/favicon.ico`, `/icon.png`, and `/apple-icon.png` as the favicon/app-icon family.
- Keep `/manifest.json` PWA identity and app naming; update metadata only in a coordinated, tested change.
- Preserve existing social handles, official outbound channels and brand spelling/capitalization.
- Do not redraw, recolor, crop, substitute, or overwrite logo/icon/favicons unless the owner explicitly approves a new asset. A responsive redesign may adjust size, clear-space, placement and backgrounds while keeping the source assets intact.
- Preserve the existing Lucide icon language and recognizable meanings. Standardize icon sizes/strokes/spacing; do not replace functional icons with arbitrary emoji or unfamiliar icon packs.

### Existing visual tokens to retain as the baseline

Source review found:
- Core navy: `#0a1428` (header/footer, dark panels, PWA theme).
- Brand red: `#D50032` in Tailwind `fact.red`; current UI also uses live red `#dc2626` / `#ef4444`.
- Dark neutral: `#1A1A1A`.
- Main light page surface: `#F0F2F5`, with white cards and slate text.
- Supporting blue: `#1562a3` / Tailwind blue family.
- Supporting green: `#6ae045` is used by the current affiliate promotion; this is not automatically a core brand color.
- Yellow/gold is used for VIP, trophies and prize status.

Create a single documented design-token layer and migrate existing hard-coded styles to it. Keep the current navy/red/neutral identity and preserve functional status colors (live, scheduled, finished, warning, success, VIP). Do not globally replace the palette or use the current affiliate green as a new primary brand color. Check contrast and color-blind legibility.

### Rebrand deliverables

- Editorial-first, sports-media visual hierarchy with a consistent responsive grid and clear type scale.
- Cohesive desktop, tablet and mobile navigation; preserve all route destinations and account/admin affordances.
- Redesigned home, live hub, matches/fixtures, match centre, news index/article, highlights, tournaments/league pages, standings, leaderboard, dashboard, VIP, login/register/recovery, help/legal and admin/CMS surfaces.
- Shared design system for cards, match states, scoreboards, tables, badges, forms, buttons, dialogs, tabs, pagination, loading/empty/error/stale states and responsive media.
- Accessible keyboard/focus states, semantic headings/landmarks, screen-reader labels, reduced-motion behavior, sufficient contrast and sensible touch targets.
- Preserve PWA install behavior, service-worker safety, global media context, audio/video picture-in-picture, match navigation, 3-second live experience and mobile behavior.
- Preserve all page metadata, canonical URLs, structured data, social sharing/OpenGraph, sitemap coverage and legacy news slugs/redirects.
- Add visual regression screenshots for representative mobile/desktop routes and compare against the approved brand baseline.

No redesign should be rolled out as a replacement until page/feature parity is tested. Rebranding is a presentation layer, not permission to remove product capability.

## 4. AdSense acceptance and monetization compatibility — release gate

### Current source observations (not an approval verdict)

- `public/ads.txt` exists and contains a Google seller record. This does not prove the live root URL serves the correct current file or that the publisher account/site is approved.
- A source scan found no AdSense loader/ad-unit implementation in the inspected V2 source paths; existing homepage monetization uses `AdsterraStandardBanner`.
- `AdsterraStandardBanner.tsx` currently promotes a 1xBet welcome bonus and promo code with an affiliate link.
- `CustomVignette.tsx` displays a timed promotional modal after 10 seconds and promotes VIP / betting-style bonus copy.
- `StickyAffiliateBanner.tsx` provides floating audio/video media controls. This is a media UX feature, not an AdSense unit; it must not obscure page content or ad units.
- Footer currently says 18+ and “Gamble Responsibly”, while also describing a free-to-play prediction game and stating that Factsport is not a bookmaker. The How-to-Play page says only VIP members qualify for monthly cash prizes. The commercial/legal nature of VIP and prize eligibility must be reconciled with actual rules and applicable law; a disclaimer alone cannot change the underlying mechanics.
- `app/robots.ts` currently decides production indexing using `VERCEL_ENV === 'production'`. The target platform is Cloudflare. On a Cloudflare build where that Vercel variable is absent, the current function can return `disallow: '/'`; this is a critical SEO/AdSense discoverability defect to fix and test using an explicit environment-aware production/staging flag.
- `app/sitemap.ts` still reads Supabase and includes match/news records plus selected routes. It must be ported to V2 read models, include approved public/legal/editorial routes, exclude private/admin/auth paths and use stable canonical metadata.
- Existing metadata advertises “Predict & Win” / “win monthly prizes”; all ad-facing descriptions must accurately describe the actual product and not obscure paid eligibility or prize mechanics.

### Policy implications

Google's current publisher guidance says sites should have unique, original, useful content and clear, easy-to-use navigation. Scraped/copyrighted content is not acceptable inventory. See:
- https://support.google.com/adsense/answer/7299563
- https://support.google.com/adsense/answer/9724

Google's Publisher Restrictions classify online real-money gambling and affiliate/aggregator promotion of online gambling as restricted content in applicable countries. Restricted inventory is not automatically a publisher-policy violation, but fewer buyers may bid and ads may not serve. Nigeria is not among the country exclusions listed on the current online-gambling publisher restriction page. Do not assume a disclaimer, age label or AdSense code placement removes this restriction. See:
- https://support.google.com/adsense/answer/10437795
- https://support.google.com/publisherpolicies/answer/10437963

Google's advertising policy for gambling operators/advertisers is a separate policy from AdSense publisher inventory rules. Do not confuse advertiser certification or eligible-state lists with publisher approval. If the site promotes gambling operators, any relevant outbound links, licensee relationship, geography, age warning, terms, privacy/controller details and required statements must be reviewed against the applicable country rules. See https://support.google.com/adspolicy/answer/15132179.

Google placement rules prohibit accidental-click layouts, misleading ad labels, unnatural attention-grabbing, auto-refreshing ad placements, and ads that overlay or sit immediately beside navigation/actions or interactive content. Ads are not to be placed on private chat screens. See:
- https://support.google.com/adsense/answer/1346295
- https://support.google.com/publisherpolicies/answer/11035030
- https://support.google.com/adsense/answer/10502938

Google reviews the whole site before ads can serve; adding a valid ads.txt record alone is not site approval. Site ownership verification and a “Ready” status are required. See https://support.google.com/adsense/answer/12131223 and https://support.google.com/adsense/answer/7584263.

### Required AdSense implementation rules

1. Keep AdSense disabled until the actual Google AdSense account, site status, domain ownership and policy review are confirmed. Never insert placeholder publisher IDs, guessed script URLs or fake ad units.
2. Verify `https://factsport.com/ads.txt` on the live domain and staging/preview isolation. Preserve the existing authorized seller line only if it matches the owner's current AdSense account. Add other sellers only from actual signed contracts/authorized seller records.
3. Separate editorial content from affiliate placements. Any non-Google affiliate promotion must be clearly labelled “Advertisement” or “Affiliate”; disclose commercial relationships, open external links safely, and never make it resemble a Google ad or navigation control.
4. Do not place Google ads beside play/pause controls, match predictions, forms, leaderboard actions, chat, video controls, install prompts, sticky overlays or other high-interaction areas. Never put AdSense on private chat, account, admin, login, payment, checkout or other non-content screens.
5. Do not auto-refresh AdSense units or force a user to view/click an ad before accessing sports content.
6. Keep ad rendering isolated behind a server-controlled feature flag and page eligibility policy. Default off in staging, admin, authenticated/private and sensitive transaction surfaces. Test no ad scripts load on disallowed paths.
7. Review and decide the 1xBet/other sportsbook affiliate placements and VIP/prize model before applying for AdSense. Safest policy posture is to keep gambling-promoting affiliate content out of the AdSense monetized content inventory (potentially on a separately reviewed, no-AdSense host/section) and not assume page-level hiding alone cures whole-site review. Any relocation or change to the affiliate/VIP product requires owner approval; do not silently remove it.
8. Do not label skill-based prediction contests “free” if payment/VIP subscription is a condition of prize eligibility. Document the true payment, entry, prize, chance/skill, age and geography mechanics; obtain policy/legal review. No marketing copy can override actual mechanics.
9. Keep user-generated content (chat, comments, predictions, community) moderated, abuse-controlled and excluded from ad placements where private communication is the primary purpose. Review user-submitted links/media before display.
10. Preserve original journalism and editorial provenance; mark AI-assisted/automated content, require factual/source review and human approval before publication. Do not mass-publish thin AI roundups to inflate page count.
11. Ensure navigation, contact/about, privacy, terms, disclaimer, editorial standards/corrections and ad/affiliate disclosure pages are complete, accurate and easy to find. Do not invent legal business details or licensing claims.
12. Use an AdSense-specific test checklist and live review; engineering can improve readiness but cannot guarantee Google acceptance.

### AdSense acceptance checklist

- [ ] Current AdSense account and factsport.com site ownership/status checked by owner.
- [ ] Google seller record verified at live `/ads.txt`; no stale/unauthorized seller lines.
- [ ] Google publisher policy and restriction review covers every public page, embedded media, user-generated content, affiliate links and VIP/prize mechanics.
- [ ] Original editorial inventory and rights/provenance review completed.
- [ ] About/contact/editorial policy/privacy/terms/disclaimer/affiliate disclosure are accurate and accessible.
- [ ] Cloudflare robots and sitemap are correct; public pages crawlable; private/admin/auth/API routes excluded.
- [ ] Ad code absent from chat, account, admin, login, payment, prediction interaction and media-control surfaces.
- [ ] Ad slots are labelled, responsive, non-obstructive, not adjacent to interactive controls, and never auto-refresh.
- [ ] Core Web Vitals, mobile usability, accessibility, consent/privacy requirements and page errors reviewed.
- [ ] Site submitted by owner and Google's actual review status is “Ready”; no claim of acceptance before that evidence.

## 5. Full parity domains — required sign-off

Use the route/page/component/data matrices as the detailed inventory. The following groups must all pass, with every row linked to source behavior and test evidence:

1. **Public sports/editorial:** home, headlines, ticker, latest news, search, news index/article, highlights, fixtures/results, match centre, leagues/tournaments, standings, scorers, team/league metadata, SEO, sharing, structured data and responsive layouts.
2. **Sports engines:** football-data.org primary free-tier fixtures/competition ingestion; ESPN coverage-gap imports; matchmaker/aliases/provider identity mapping; ESPN live for linked matches; FD delayed live for unmatched matches and approved fallback only during verified ESPN upstream outage; FT verification/correction; events, clock, lineups, stats, H2H, venue/referee, team form, logos and highlights.
3. **Identity/account:** signup, verification, login, logout, session refresh/revocation, recovery/password update, duplicate identity/linking, blocked users, profile/settings, consent, export/deletion, stable internal UUID and secure authorization.
4. **Gameplay/rewards:** daily first-five rule, kickoff locks, 3-point outcome, 10-point exact score (13 total where both match), bonus markets, campaign-specific scoring, eligibility, VIP access/expiry, monthly thresholds/diversity/activity/draw/zero-score rules, leaderboard, monthly winner audit, ties, approvals, reset and correction/reversal.
5. **Payments/VIP:** plan display, payment methods/instructions, proof uploads, manual/sandbox/provider verification, subscription states, approval/rejection, idempotent entitlement grant/expiry, financial evidence privacy, receipts/notifications and audit.
6. **Admin/CMS:** role-scoped dashboards and actions, step-up/MFA, users/VIP, match corrections, provider links, campaigns/rules/settings, studio/stream, editorial drafts/revisions/review/publish/unpublish, social config, media and audit history.
7. **Community/media:** live hub, chat, moderation, MOTM eligibility/candidate/vote, match pins/follows, stream token/entitlement, highlights, media upload, global audio/video state and picture-in-picture.
8. **Automation/integrations:** fixture schedule, ESPN cups, matchmaker, live DB snapshot, FT verification, settlement, standings, monthly audit/reset, AI preview/roundups, direct Facebook/Telegram, Buffer/Make via selected adapter, logo/highlight sync, indexing, email, unconfirmed-user cleanup, social/media/log retention.
9. **Platform/operations:** PWA install, service worker, route caching, API cache isolation, rate limits, bot/Turnstile, backups/PITR/restore, logs/alerts, performance, accessibility, SEO, robots, sitemap, rollback and Cloudflare-only deployment.

## 6. Completion evidence required per feature

Every page/route/component/domain/job must carry:
- Legacy source path(s), function(s), and current observed behavior.
- V2 owner/service/adapter/schema and authorization policy.
- Explicit decision: preserve as-is, secure equivalent, changed with approval, or not applicable with evidence.
- Unit tests, DB integration tests, provider fixtures/contract tests, authorization negative tests and browser journey tests as applicable.
- Loading, empty, stale, timeout, error, retry, duplicate/replay and concurrency behavior.
- Mobile/desktop accessibility and visual regression where user-facing.
- Observability, runbook, rollback and data-retention decision.
- Evidence label: INVENTORIED / VERIFIED SOURCE / DB VERIFIED / RUNTIME VERIFIED / OWNER APPROVED.

No “done” checkbox may be marked from source-only inspection where runtime evidence is required.

## 7. Delivery order and current blockers

Follow the master roadmap milestones M0–M11 and production workstreams P0–P9. Immediate order:
1. Freeze and verify a legacy feature baseline; expand source audit across all pages, routes, 54 component files, scripts, workflows, adapters, environment variable names and external worker consumers.
2. Close security/release blockers (legacy Supabase exposure review, main protection, staging runtime stability, deterministic CI).
3. Complete schema/roles/job ledger and sports ingestion/live/match-centre parity.
4. Build public editorial/media surfaces and full responsive rebrand, preserving brand assets.
5. Complete identity/admin and account lifecycle.
6. Complete gameplay, VIP/payment and transactional settlement parity.
7. Complete community/media and integrations/automation.
8. Complete AdSense policy remediation and owner/legal decisions before activating Google ads.
9. Full browser journeys, accessibility, visual regression, provider failures, load/performance, restore and cutover rehearsal.
10. Explicit owner production go/no-go; only then production deployment and DNS/route changes.

**Current known blockers:** the v2 staging app currently proves only protected health and matches read paths; most pages/routes/components still depend on legacy Supabase or external services. No AdSense code implementation was found in the inspected source; current betting-affiliate promotions and VIP prize eligibility need policy/legal review. Cloudflare robots logic currently relies on Vercel environment detection and must be corrected before production indexing. No live AdSense approval is evidenced.

## 8. Explicit no-change boundary

This contract does not authorize:
- production DNS/Worker/routes/database/legacy Supabase changes;
- destructive data resets or source database deletion;
- production secret rotations or external worker retirement;
- unreviewed changes to betting/VIP/payment/prize mechanics;
- removal of Facebook/Telegram, external live data, chat, MOTM, PWA or other existing functionality;
- replacement of current logo, favicon, app icon, brand colors or icon language;
- publishing AI content or importing unreviewed legacy editorial assets;
- enabling AdSense before owner account status and Google policy readiness are confirmed.

All such work remains staging-only or requires explicit owner approval as stated in the governing roadmap.


## 10. Owner-confirmed Day 1 adapters and AdSense-first product decision (2026-11-07)

### Day 1 platform adapters

- **Identity:** Microsoft Entra ID is the Day 1 identity adapter. Keep the provider-neutral auth port, and prove real staging sign-in, callback validation, session lifecycle, logout, role/privilege mapping, recovery and failure behavior before declaring auth complete.
- **Automation:** Azure Logic Apps is the Day 1 durable-job adapter. Preserve durable execution, idempotency keys, bounded retries, dead-letter/failed-run visibility, and exactly one owner for each scheduled job. Test actual staging runs, retries and duplicate delivery; a configured workflow alone is not completion evidence.
- **Social:** Preserve direct Facebook and Telegram integrations. Support Logic Apps as the Day 1 orchestration adapter and Mkety/Cloudflare workflows as the platform-native integration path. Keep credentials server-side and verify retries, rate limits, deduplication and audit trails.
- **Brand:** Green is not part of the core Factsport brand palette. The current affiliate green is confined to affiliate promotional treatment and must not be promoted into the rebrand's primary design tokens.

### AdSense-first public product decision

The owner has chosen to prioritize a clean AdSense-eligible public football-media experience. This is a risk-reduction target, not a promise of Google approval.

1. Remove betting operator banners, bookmaker bonus codes, betting affiliate calls-to-action and associated promotional widgets from the public V2 experience. Do not reintroduce them in metadata, feeds, structured data, editorial templates, navigation or public landing pages.
2. Remove unsolicited timed promotional popups and pop-under behavior from the public experience.
3. Retain the underlying affiliate integration capability only as dormant/non-public capability; no betting campaign is enabled on the AdSense-first public site.
4. Suspend public promotion of VIP cash prizes, paid-entry competitions and betting-slip benefits until the actual financial, eligibility, prize funding, chance/skill, legal and Google policy mechanics have been audited. A disclaimer or a noindex tag is not a substitute for changing underlying behavior.
5. Free, non-monetary football predictions, points, statistics and editorial analysis may remain, provided they do not direct users to wagering, quote bookmaker odds, encourage staking or imply cash rewards.
6. A paid VIP subscription may return to public promotion only after it is a clearly described subscription for non-gambling benefits and has no paid-entry contest, wagering or cash-prize dependency. Preserve records and existing obligations; do not erase or silently cancel them.
7. No AdSense code until Google site/account approval is confirmed and the site-wide audit, consent/privacy requirements, ads.txt and crawlability checks pass. Eligible ad units must be clearly labelled and separated from navigation, buttons, match controls and other interactive content. Never place units in chat, email, account, payment, admin or private communications.
8. Current V2 source changes remove the betting promotion from the homepage and remove the timed global vignette. The legacy how-to-play page is marked noindex and removed from the sitemap pending redesign; the VIP upgrade route also requires a noindex layout and policy review before it can be considered public editorial inventory.
9. The explicit Cloudflare production indexing gate is FACTSPORT_INDEXING_ENABLED=true, additionally conditioned on NODE_ENV=production; unset/false means disallow crawling. Do not enable it until sitemap data is migrated from legacy Supabase to the V2 PostgreSQL read model and live robots/sitemap/ads.txt responses are verified.
10. Remaining mandatory work: audit all betting/promo components and their call sites, campaign/prize settlement and payout code, VIP checkout/renewal/entitlements, affiliate links in content and feeds, page metadata/OG/schema, privacy/consent, editorial provenance, and live Cloudflare responses. This decision does not declare those audits complete.


## 11. Owner-confirmed two-experience product separation (2026-11-07)

The owner has clarified that VIP, premium prediction, betting-related and existing prize/business workflows must remain functional. The AdSense decision is therefore a separation of products and advertising surfaces, not deletion of the business system.

### Public Factsport — AdSense-first experience (`factsport.com`)

- Public football editorial, news, fixtures, live scores, match centre, standings, tournaments, highlights and original analysis.
- Free, non-monetary predictions, scoring, points, statistics and leaderboards may remain available when they do not involve a paid entry, wager, bookmaker odds, betting referral or cash/prize inducement.
- Public navigation and metadata must accurately describe this editorial/free experience.
- AdSense is considered only on approved public editorial/informational content pages, after site and account approval, privacy/consent review and live technical checks.
- No AdSense on authentication, account, private messages, chat, payment, admin, match controls or non-content pages.

### Private Factsport product — preserve existing business functionality

- Preserve VIP membership, premium prediction logic, betting-slip features, affiliate integrations, campaign configuration, existing prize eligibility/settlement workflows and associated admin capabilities as a separate product capability.
- Preferred isolation is a dedicated private product hostname and independently controlled deployment boundary (ideally a separate registrable domain), e.g. a future `Factsport Club` service. It must not share AdSense code, publisher IDs, ad slots, ads.txt declarations, crawler login credentials or ad-serving configuration.
- Do not expose betting/promo widgets, bookmaker links, betting odds, cash-prize inducements or premium betting claims in public editorial templates, public metadata, public feeds, public structured data, public sitemap or public landing pages.
- Access must be enforced server-side using the approved identity adapter and authoritative V2 entitlements/roles. Client-only VIP checks, hidden UI, `noindex`, robots exclusions or obscured content are not authorization controls.
- Keep private product routes out of public sitemaps and apply noindex where appropriate, but do not treat noindex as a policy workaround or as a substitute for a distinct product boundary.
- The private product receives no AdSense. Do not configure Google's login-protected crawler access for it. Users and crawlers must not be served different content to conceal the product.
- Preserve transactional records, active memberships, outstanding obligations, campaign and prize audit trails. No destructive migration or silent cancellation.
- The business must receive a separate legal and payment-provider review. Paid VIP + cash-prize eligibility and any betting-related functionality may fall within online gambling restrictions or applicable local licensing rules depending on actual mechanics. A separate hostname does not legalize the product or guarantee AdSense approval for the public property.

### Separation architecture and acceptance gates

1. Keep one source repository and shared domain contracts where useful, but split public and private route manifests, app shells, navigation, content queries, deployment configuration and ad configuration.
2. Create a private product host/deployment only after the owner confirms its hostname/domain and the Cloudflare DNS/Worker ownership boundary. Do not invent or change production DNS as part of this work.
3. Public route tests must prove that no betting affiliate URL, bookmaker promo, odds/accumulator content, cash-prize inducement or VIP purchase CTA leaks into public routes, metadata, feeds, structured data or server-rendered HTML.
4. Private route tests must prove unauthenticated access is denied server-side, non-VIP users cannot access VIP entitlements, role checks are server authoritative, and existing prediction/settlement/admin workflows remain functional.
5. Ad tests must prove zero AdSense script/ad-unit requests on private routes and zero ad placements on private/account/payment/admin/chat/interactive control surfaces.
6. Cross-surface links must be factual, clearly labelled and reviewed; no affiliate or betting promotion may be routed through a nominally editorial page to evade publisher review.
7. Google site approval remains an external decision. Separation is a risk-reduction architecture, not a guarantee of approval. Google may consider the actual content and links present on a monetized page and its destination.

### Implementation status

- The first AdSense-first changes already removed the homepage betting banner and global timed promo modal, revised the public metadata, and restricted legacy VIP/prize pages from indexing.
- The VIP upgrade copy was changed to remove betting-slip, odds and cash-prize sales claims while retaining the underlying route and membership workflow. This is a temporary presentation step, not the final private product separation.
- The next implementation milestone is to map every public/private route and component call site, preserve the free prediction flow on the public experience, and move premium/business surfaces behind the private host boundary once the hostname and staging access design are confirmed.
- No private business workflow is approved for deletion. No production host/DNS/Worker change is authorized by this separation decision alone.


## 12. Owner-approved identity and anonymous prediction model (AUTH-005)

The owner has confirmed exactly two user states: (1) anonymous public visitors who can submit free predictions without registration, email or verification; and (2) registered Predict members whose single canonical Factsport account is managed through `predict.factsport.com`. There is no intermediate email-identified participant state. The public prediction form must not collect email. Newsletter/product marketing, if later introduced, requires a separate optional consent flow and is not bundled with predictions.

The public prediction path must use a first-party opaque anonymous participant cookie and a server-side API/Worker; persist only a one-way token hash, enforce kickoff/duplicate/idempotency/rate-limit rules server-side and in PostgreSQL, and never expose direct browser writes. Same-browser anonymous history may be claimed after Predict registration using the protected cookie, never email matching; conflicts must preserve original records. Anonymous predictions are not automatically prize-eligible. Entra External ID remains the Day 1 registered-account adapter, subject to staging verification. Full implementation contract and acceptance criteria: `docs/audit/AUTH-005-public-anonymous-predictions-single-predict-account.md`.

The legacy `PredictionBoard` currently redirects unauthenticated visitors to `/login` and writes directly to Supabase `user_predictions`. Removing that redirect alone is unsafe and insufficient. Replace the direct write path only after the V2 participant schema, dedicated least-privilege prediction API role, server-side API and staging tests are in place. Existing campaign scoring, bonus markets, settlement, user records, VIP entitlements and prize audit history must be preserved.


## 13. Anonymous prediction schema implementation checkpoint

The first staging-code slice is committed: `db/migrations/0003_factsport_public_predictions.sql` adds pseudonymous visitor participants, predictions, account-claim audit events and same-match conflict records. It contains no email/marketing identity and grants no direct public access. Prediction rows default to prize-ineligible and enforce participant/match uniqueness, registered-user/match uniqueness, valid outcomes and paired nonnegative scores. `tests/prediction-schema.test.cjs` is included in V2 verification.

This migration is **not applied** to Azure PostgreSQL. The app's current Hyperdrive reader role cannot write predictions. Before the public board is changed, implement and verify a dedicated least-privilege prediction API role/Hyperdrive, server-side visitor cookie/session, transactional kickoff/duplicate enforcement, anonymous-to-account claim and conflict handling. The legacy PredictionBoard remains login-gated and Supabase-backed until that secure replacement is ready.


## 14. Owner clarification — free prediction email capture and marketing consent

The owner has clarified the public flow: ordinary browsing and prediction selection show no email form. Clicking **Submit Prediction** reveals a form requiring email, prediction details and acceptance of the free-prediction rules/privacy notice. No registered account is created. A privacy-safe display identity appears on the free leaderboard. The private `predict.factsport.com` product continues to require full registration.

The marketing checkbox is separate, optional and unticked by default. Only explicit opt-in creates a pending marketing subscription; declining marketing must not block a free prediction. Consent wording/version, timestamp, source, confirmation and withdrawal are auditable. No promotional mail is sent until the address is confirmed. The database migration now includes `prediction_contacts`, `marketing_subscriptions` and `marketing_consent_events`; it remains unapplied to Azure. This is the recommended compliant implementation: direct-marketing consent must be a genuine choice under the Nigeria NDPA/GAID framework. Final privacy/consent wording and any cross-border email-provider processing require legal review.
