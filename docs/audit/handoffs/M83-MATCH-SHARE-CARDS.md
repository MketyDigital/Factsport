# M83 — Match result and starting-lineup share cards

**Date:** 2026-11-21  
**Branch:** `refactor/factsport-v2`  
**Status:** source and staging smoke committed; exact-head workflow/browser acceptance pending. No production change.

## Governing scope

Implemented the next M74-D social-preview slice from the M74 visual handoff and ROADMAP M1/M8/M10. The acceptance limits remain in force: use only sourced values, keep public Media metadata free of Prediction product wording, avoid unlicensed remote assets, and verify OG output on the exact staging head before calling it runtime accepted. The existing Stats/lineup data remains from the canonical match snapshot; no D1, external legacy Worker, or second DB path was added.

## Changes

- Added a text-only `result` Open Graph template. It renders only nonnegative integer home/away scores, team names and league; otherwise it returns a neutral result-unavailable card. It loads no remote crests, photos or logos.
- Added a text-only `lineups` Open Graph template. It renders only when both sides contain eleven named starters marked `is_starter`; incomplete input returns a neutral unavailable card. It uses no fabricated player names/positions or remote images.
- Wired finished matches with valid scores to the result card, and upcoming matches with complete lineups to the starting-XI card. Live and incomplete matches keep their existing versus behavior.
- Removed “Predictions” from the public match page title metadata; retained H2H, stats and live-score wording.
- Extended `.github/workflows/v2-app-staging.yml` to request both templates with a short-lived CI token and require a non-empty `image/png` result.
- Source commits: `5663872` (renderers), `ab90b16` (metadata), `5755f2f` (long-label bounds), `5429f86` (staging smoke), and `8803c41` (1200×630 PNG dimension assertions).

## Acceptance still required

The staging workflow was just extended and its result on the exact source head has not yet been confirmed. Its acceptance checks now require the PNG signature and exact 1200×630 dimensions for the article, result and lineup cards. A PNG response proves the renderer produced an image, not that its typography is visually correct or that social crawlers can reach it on the eventual public host. Still required: inspect a real generated result and lineup card, verify the actual metadata on the match route, review mobile/crawler behavior, and confirm lineups/scores match ESPN/PostgreSQL source data. Rights and production OG URL accessibility remain open.

The staging-only Entra callback remediation in M82 is a separate, still-unverified sign-in path. The user must complete the real editor callback and authorize exact issuer/subject linkage; this M83 work does not close identity/RBAC.

No migrations, roles, runtime secrets, public routes, production DNS, Ads, Logic Apps, Prediction cutover, or TV implementation were changed. P9A remains blocked on its complete Media, match-lifecycle, security, restore and route-isolation gates; P9B and P10 remain later phases.

## Next

1. Verify the exact-head isolated and protected staging workflows, including result/lineup PNG checks and the callback smoke.
2. Inspect the cards in an image viewer or authenticated browser, then validate generated page metadata and safe public crawler behavior when permitted.
3. Continue M74-A/B/C/D page and mobile/accessibility acceptance, editor workflow, ESPN-linked match lifecycle, V2-target recovery rehearsal and P9A route isolation.
