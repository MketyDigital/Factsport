# M74 — Factsport Media 2D/2.5D visual system, match center and social-preview foundation

**Date:** 2026-11-16  
**Branch:** `refactor/factsport-v2`  
**Status:** SOURCE IMPLEMENTATION + SOURCE TESTS COMMITTED. Full engine suite, TypeScript, Vinext, protected Cloudflare staging, browser screenshots, real OG crawler and accessibility/performance acceptance **NOT VERIFIED**.

## 1. Owner instruction and relationship to existing plans

The owner requires the existing Factsport V2 Media experience to become premium visual sports media rather than text-heavy: homepage, live/matches, league/standings, match center and **all** match-details tabs, news/highlights/social preview/sharing. Use 2D/purposeful 2.5D and selective 3D where supported; no heavy 3D/WebGL default or fake source data. It must look attractive on mobile and desktop, remain fast, AdSense-safe, SEO/crawler-friendly, accessible, and integrated with two-in-one product ownership (Factsport.com **Media** first; separate `predict.factsport.com` Prediction).

This is explicitly integrated with master `docs/audit/ROADMAP.md` **M1, M8 and M10**, plus `docs/audit/PRODUCTION-EXECUTION-PLAN.md`. Both governing documents were edited during M74. This milestone is the **first implementation slice**, not a claim that the complete multi-page visual redesign is finished.

The M70-M73 owner decisions remain binding: archived D1 scripts never active; anonymous Media chat/MOTM without accounts; Prediction stays separate; approved Stream.io room studio remains; owner rejected paid Cloudflare Stream hosted VOD; no new ad code/monetization assumptions.

## 2. Source baseline and files inspected

Starting from the branch containing handoff `M73-ACCOUNT-FREE-MEDIA-CHAT-MOTM-POSTGRES.md`, source inspected:
- `docs/audit/ROADMAP.md`, `docs/audit/PRODUCTION-EXECUTION-PLAN.md`, and M73 community handoff.
- `app/page.tsx`, `HeroMatchCards.tsx`, `CompactMatchRow.tsx`, `MatchRow.tsx`, `MatchesClientView.tsx`, `MatchHeaderClient.tsx`.
- `StatsLineupsTabs.tsx`, `PitchLineup.tsx`, `MatchTimeline.tsx`, `LiveStandings.tsx`, `MiniStandings.tsx`, `MatchMobileHub.tsx`.
- `app/standings/page.tsx`, `app/match/[id]/page.tsx`, `app/api/og/route.tsx`, `ShareButton.tsx`, `app/globals.css`.

**Key preexisting capabilities to preserve:** the 2D pitch, formations, event chronology, match time, tabs, canonical IDs, live ESPN frontend, conditional public media, standings stage/group logic, existing OG `versus` and `pitch` formats and rights-reviewed social outbox. The original social generator was already substantial (not missing) and should be **extended** rather than replaced.

## 3. Implementation committed

### Visual foundation and match details
- `app/components/VisualStatCompare.tsx`: new accessible team-side stat card with large numeric values, descriptive label and proportional color bars. Parser accepts only finite nonnegative numbers, including percentages, and retains `null`/unknown as unknown. A 0–0 stat uses a neutral track instead of showing invented 50/50 dominance.
- `StatsLineupsTabs.tsx`: replaced tiny `StatRow` bars with visual cards in a responsive grid, removed fabricated `50%` possession and default `0` shots/corners/fouls/saves, preserved original lineup/pitch and player rating tools, kept the event timeline full width. Direct or derived shots only display when valid provider values exist.
- `PitchLineup.tsx`: enhanced the existing 2D pitch with a subtle green gradient, elevated player tiles and a descriptive pitch group label; existing starting XI, formation, substitute cards and behavior retained. Removed fake click affordance/entrance animation from static player markers.
- `app/globals.css`: centralized `fs-visual-panel`, `fs-visual-card`, `fs-visual-card-interactive`, live status and standings rank tokens. All hover lift effects respect `prefers-reduced-motion`; no JavaScript 3D runtime/WebGL/canvas dependency introduced.

### Homepage and matches
- `HeroMatchCards.tsx`: deeper, larger and keyboard-focus-visible featured match panels, with existing imagery, crest/media markers and score data retained. Fixed the shared fetcher invocation to pass **canonical match ID** and ignore backend `stale:true` results—important because the M71/M72 V2 ESPN reader deliberately rejects legacy-ID-only calls.
- `CompactMatchRow.tsx`: cohesive elevation and focus treatment for fixture/result cards; same canonical-ID and stale-fallback correction. No new live polling cadence, media permissions or Prediction data path introduced.

### Standings
- `app/standings/page.tsx`: preserved semantic `<table>`, group/knockout structure, all columns, team links, existing promotion/relegation logic and form display. Added elevated container, visible rank pill, strong points capsule and bigger accessible W/D/L form chips. Did **not** invent new movement/qualification logic.
- `generateMetadata` now restricts the league used in social card generation to the existing `LEAGUE_MAP` keys, UTF-8-safe encodes the payload and includes exact 1200x630 Open Graph image plus `summary_large_image` metadata.
- `app/api/og/route.tsx`: added `type: 'standings'` to the existing `ImageResponse` engine, with league branding, layered typography and an abstract decorative chart. **It is explicitly a league preview, not a fabricated ranking**. Original `versus` and `pitch` modes untouched; no new third-party image generator, logo download or paid service.

### Tests
- `tests/media-visual-system.test.cjs`: six focused tests: execute the actual visual-stat parser via Node VM; assert no invented defaults and retained timeline/pitch; confirm canonical live fetch + stale-protection in two card families; assert semantic standings rank/points/form; assert existing OG renderer reused and original share formats intact; preserve pitch formations/bench and lightweight accessible depth.

Selected commits in implementation order:
- `d6dcdee` reusable stat card; `1db19cc` Stats tab integration; `d50890d` depth tokens; `4f4f573` homepage hero/canonical match.
- `6217ea7` match list card; `7a21730` standings presentation; `1517d0f` correct rank JSX; `60ff810` full-width timeline.
- `a9f2dc6` OG standings template; `db82bf2` standings metadata; `b44e9fb` regression tests; `c3e3fd0` and `93a1da0` correct regex escapes; `36af1fa` neutral 0–0 stat bar.
- `b136941` pitch depth; `6aaf63c` pitch regression; `1424140` renderer-compatible OG styling.
- `57ec97f` master roadmap M8 expansion; `3a65a5d` execution plan M74 gates.

## 4. Not implemented / nonclaims

**NOT** claiming the full visual redesign of the entire site is complete:
- News/editorial hero, article cards/search and highlights, match-header scoreboard, team form/H2H, league hubs and deeper standings cards remain to be applied consistently.
- Tactical pitch improvements, shot location and momentum require provider-sourced positions/events; no fictitious shot maps or invented metrics.
- Match tabs (overview, chat/MOTM, H2H, live table and video) need coordinated mobile/desktop UI review. The later M84 owner-approved boundary removes Prediction entry and probability UI from the public Media match page; Prediction remains separate under P9B. Do not restore a Prediction tab to Media without a new owner decision.
- The article social card is now source-implemented and authorized-staging-smoke-verified (2026-11-20). FT, lineups and verified MOTM templates remain, as do production OG crawler, rights and expiry validation. The article card uses bounded editorial text and does not fetch remote images. The generic OG renderer is not an authorization mechanism for external image URLs; inspect and harden remote image-fetch policy before using rights-sensitive artwork.
- No real browser screenshots, mobile interaction testing, contrast audit, Core Web Vitals measurement, semantic screen reader audit or Cloudflare ImageResponse/preview crawl have been executed.
- At M74 handoff time, no code had been deployed. On 2026-11-20 the current branch was rebuilt and deployed to the separate staging Worker only; production DNS, routes and data were not changed. No chat/MOTM enablement, D1, AdSense, paid Cloudflare Stream or Stream.io rooms were changed.

## 5. Acceptance criteria and rollback

1. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` on the latest V2 head. Correct all failures. Source tests alone do not prove TypeScript/Vinext compatibility.
2. Protected Cloudflare staging: browser screenshots at 320px / 375px / 768px / 1440px on homepage, matches fixtures/results, league/group standings, match scoreboard, stats, lineups, timeline, chat/MOTM, and article preview; no overflow or low-contrast labels.
3. Compare real ESPN data for null scores, 0–0, partial possession, missing shots, changing status/clock and 3s updates. Cards must not propagate `stale:true` payloads, lose media URLs or change eligibility/scoring systems.
4. Inspect keyboard navigation, accessible names for all stat bars/player pitch/form indicators, reduced-motion behavior, actual 1200x630 generated card, X/Facebook/WhatsApp/Telegram crawler images and no false rankings.
5. Verify brand consistency, image rights/provenance, safe social remote images, and AdSense content/ad-position separation. Avoid monetizing interactive chat/Prediction pages through unapproved ad integrations.
6. Rollback individual M74 source commits or restore previous components/OG template; no migration or data rollback is required for this UI slice.

**Next actions:** finish remaining M74-A/B/C/D source integrations, run real test/build/staging checks, then review all Media/Predict feature parity and production cutover with explicit owner approval.

## 10. 2026-11-23 — match-center visual continuation

- Owner reports the Entra callback issue is addressed; this is not by itself evidence of the full editor draft/review/publish/unpublish/logout journey.
- Began the remaining M74-A scoreboard work in `app/components/MatchHeaderClient.tsx`: larger responsive team and score panels, clearer status and match metadata, keyboard-focus visibility, decorative-image semantics, and null-safe score display that does not invent a 0–0 result. Existing match data, live updates, status logic, canonical navigation and media behavior are retained.
- Added a source regression assertion for responsive/focus behavior and unknown-score preservation. Local engine suite (292/292), TypeScript and Vinext build passed on the working tree. No exact-head CI, protected staging visual inspection or mobile/desktop screenshots have yet run for this change.
- This is one M74-A visual increment, not completion of M74 or the full frontend repositioning. News, highlights, match tabs/lineups/timeline, standings/league pages, accessibility and browser visual review remain open. Public Media stays separate from Prediction (M84/P9B); Factsport TV remains later P10.


## 7. 2026-11-20 follow-up — article share card

- Added the Factsport-owned text-only `article` renderer to `app/api/og/route.tsx` and connected article Open Graph/Twitter metadata in `app/news/[slug]/page.tsx`. Input text is bounded; no remote image is fetched by this card.
- Added regression coverage in `tests/media-visual-system.test.cjs`.
- Added a staging smoke to `.github/workflows/v2-app-staging.yml` that sends a temporary staging-token-authorized article preview payload and requires a non-empty `image/png` response.
- Source commits: `13f3a98`, `5487dfb`, `7f5a370`, `aef7cdb`, and smoke check `8b29c75`.
- Verification: native vinext build `44702832677` passed; isolated verification `44703313261` passed; protected staging deploy and smoke `44703313309` passed, including the article PNG check.
- A direct unauthenticated browser request to staging `/api/og` returned the staging gate's 404. This is not public crawler acceptance. Re-test the generated metadata and card on a public production-like host after route policy is defined, without exposing the staging token.
- Remaining M74 acceptance is unchanged: all-tab/mobile/desktop screenshot review, accessibility/contrast, Core Web Vitals, licensed imagery and remote-image policy, FT/lineup/verified-MOTM templates, and full article/news/match/standings route review. No production cutover.


## 8. 2026-11-21 follow-up — result and starting-XI social cards

- Added dedicated text-only result and starting-lineup OG templates in `app/api/og/route.tsx`. Full-time cards require valid nonnegative integer scores; lineup cards require eleven named starters for each team. Neither template fetches remote logos or player imagery, and incomplete source data returns an unavailable card.
- Match-page metadata selects result cards only for finished matches with valid scores and lineup cards only for upcoming matches with complete starting elevens. Existing versus metadata remains for live or incomplete matches.
- Removed Prediction wording from the public match-page title metadata. This does not close the full route/product separation or Prediction release.
- Added staging smoke checks requiring non-empty 1200×630 PNG responses for both templates. Source commits: `5663872`, `ab90b16`, `5755f2f`, `5429f86`, `8803c41`.
- Exact-head staging/build results, image inspection, actual route metadata, public crawler delivery, licensed asset policy, accessibility and mobile acceptance remain unverified. See [M83](./M83-MATCH-SHARE-CARDS.md).


## 9. 2026-11-22 follow-up — M88 exact-head staging evidence

The exact source commit `418edd7400e053e27b6bcb020c00b1e5fe695f5b` passed isolated verification [45044116175](https://github.com/MketyDigital/Factsport/actions/runs/45044116175), native Cloudflare build [45044116156](https://github.com/MketyDigital/Factsport/actions/runs/45044116156), and protected Cloudflare staging [45044117315](https://github.com/MketyDigital/Factsport/actions/runs/45044117315). The protected run rendered PostgreSQL-backed `/matches` and a real `/match/{id}`, checked public match-content isolation, and returned 1200×630 PNGs for article, result, and lineup share-card smoke inputs. The read-only database probe and Entra protocol-boundary checks also passed.

This closes the earlier claim that exact-head staging smoke was pending. It does not close visual inspection of generated cards, actual route metadata/crawler delivery, all-tab/mobile/desktop screenshots, accessibility/contrast, Core Web Vitals, editorial rights/provenance, remote-image policy, the complete news/standings/live/match lifecycle, or authenticated Entra editor publish/unpublish/logout. Those remain open M74/P9A acceptance gates. The staging smoke is a renderer/runtime check, not a visual or public-crawler review. No production cutover occurred.


## 10. 2026-11-22 follow-up — PostgreSQL-backed homepage/news staging

After the M88 match-detail repair, reviewed migrations 0006, 0007, 0024 and 0025 and enabled `FACTSPORT_EDITORIAL_BACKEND=postgres` plus `FACTSPORT_HOMEPAGE_BACKEND=postgres` only in the separate V2 staging Worker. Existing Cloudflare reader/editorial Hyperdrive bindings and migration-granted public views are used. The staging workflow now requires authorized `/` and `/news` page responses with expected navigation/headings.

Exact branch head `2c79d0fec4072c57654be8d8b4aebb16fa5e7e6c` passed isolated verification [45045456878](https://github.com/MketyDigital/Factsport/actions/runs/45045456878) and protected Cloudflare staging build/deploy [45045456852](https://github.com/MketyDigital/Factsport/actions/runs/45045456852). This validates the server-rendered paths. It does not establish that public articles, highlights, or featured rows are populated, nor close M74 responsive visual review, crawler, rights, accessibility, performance, complete match lifecycle or editor publish workflow. Production remains unchanged.
