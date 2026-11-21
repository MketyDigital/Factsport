# M84 — Public Media and Prediction surface isolation

**Date:** 2026-11-21  
**Branch:** `refactor/factsport-v2`  
**Status:** public-surface source change and protected-staging assertion committed; exact-head result pending. No production change.

## Governing decisions

Reconciles ROADMAP M1/M8/M10, the parity/AdSense acceptance contract, P9A/P9B in the production execution plan, and M74/M77. Public Factsport Media and the private Prediction/business product have distinct release boundaries. P9A must not expose Prediction registration, VIP, bookmaker or betting actions on Media pages. Prediction source, schema, and future private-host functionality are retained for P9B; this handoff does not migrate or cut over those systems.

## Implemented

- Removed public match-row and compact-match-card “Predict”, booking-code, “Bet Now”, and default affiliate-link actions. Public match cards now navigate to match details and display sourced score/status only.
- Removed the Media match detail’s public prediction submit panel and the associated Match Center prediction tab/model probability widget. The public match page title already stopped advertising Predictions under M83.
- Relabeled the homepage shortcut from “Predict” to “Matches” because it navigates to `/matches`.
- Left Prediction schemas, components, APIs and feature-flag configuration in the repository for the separate P9B product. No Prediction records, accounts, scores, payments, prizes or entitlements were altered.
- Extended the staging workflow to fetch a real staged fixture’s match-detail page and fail if the public `/matches` list or `/match/{id}` page renders Prediction or bookmaker actions/content.
- Stripped the `predictor` model from both the public match detail's serialized client projection and the public same-origin live-match API responses (cached, live and DB fallback). The public Media UI no longer receives the private probability model.
- Added an optional staging probe for the public live-match API: when enabled, it requires JSON without a `predictor` property; a deliberate 503 feature-off response remains a skip.
- Source commits: `1e98214` (`MatchRow`), `45a6457` (`CompactMatchRow`), `1cf686b` (match detail UI), `bc5bd6b` (`MatchMobileHub`), `a123041` (home shortcut), `ed5b69f` and `96fbd94` (live API projection), `219c102` and `c11bbba` (match page projection/query), and `10eba92`, `6e34c90`, `5e081cd` (staging boundary/data smoke).

## Acceptance and limits

Exact-head source/build and protected-staging results are not yet verified. The new smoke checks rendered public HTML on staging but does not prove every Media route, PWA manifest, server metadata/feed, or browser navigation is Prediction-free. Run the page/route scan and user-facing browser review before P9A. Private-host Prediction identity, registration, settlement, VIP/payment, prizes and audit remain P9B work.

Production routes, domains, databases, jobs, secrets, Logic Apps, AdSense, and legacy systems were not changed. No P9A release gate is closed.

## Next

1. Verify exact-head isolated build and protected staging, including the new match list/detail assertion and M82/M83 checks.
2. Audit all public pages, metadata, feeds, structured data, manifest and navigation for Prediction/VIP/bookmaker leakage; keep any product actions behind the private host in a later phase.
3. Continue Media editorial and sports lifecycle acceptance, then V2 recovery/rollback and P9A route-isolation/go-no-go. Continue P9B and only later P10 TV.
