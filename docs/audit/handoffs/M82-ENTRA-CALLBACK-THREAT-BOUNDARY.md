# M82 — Entra callback threat-filter boundary and release reposition

**Date:** 2026-11-21  
**Branch:** `refactor/factsport-v2`  
**Status:** source and staging-workflow change committed; automatic verification result not yet confirmed. No production change.

## Governing documents re-read

- `docs/audit/ROADMAP.md`, including M74, M78, M79, M81 and the 2026-11-20 exact-head coordination record.
- `docs/audit/PRODUCTION-EXECUTION-PLAN.md`, especially P4 identity/security, P8 recovery/security, P9A Media-only release, P9B Prediction/business, P9C legacy retirement and P10 TV.
- `docs/audit/handoffs/M77-CURRENT-STATE-AND-CUTOVER-READINESS.md`.
- `docs/audit/handoffs/M74-MEDIA-VISUAL-SYSTEM-MATCH-CENTER-AND-SHARE.md`.
- `docs/audit/handoffs/M78-FACTSPORT-TV-AND-PHASED-RELEASE.md`, `docs/implementation/TV-001-factsport-tv-engine.md`, and `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`.

The M77/M74 acceptance boundary remains controlling: source presence and health probes are not complete editor, public-media, match-lifecycle or release acceptance. Release remains Media P9A first if separable; Prediction P9B next; TV P10 after both. There is no V2 legacy-database restore/import. The existing `factsport_v2` database is the clean-start target, and the disabled design-only Logic App stays disabled until its separate provisioning/operations gate passes.

## User-observed failure and bounded source change

The reported Entra browser return displayed the legacy middleware text “Forbidden Request: Malicious payload detected.” Source inspection found that middleware already exempted callback query parameters, but still evaluated the callback path through the general threat-pattern filter. The exact callback pathname has no matching suspicious pattern, so the source observation does not prove whether the error was from an older deployed Worker, a different request form, or an upstream layer. A staging deployment and browser retest are still needed to establish the runtime cause.

- Middleware now skips the legacy path-and-query heuristic only for the exact `GET /api/auth/entra/callback` route. The callback continues to enforce its HTTPS host restriction, bounded code/state/state-cookie sizes, encrypted state, state equality, PKCE, issuer, audience, signature, nonce and the existing exact issuer/subject editorial identity link. Every other route retains both path and query checks.
- The staging workflow now submits deliberately opaque encoded callback values **without** an OIDC state cookie and requires the handler to redirect to the generic callback-failure page. This demonstrates fail-closed validation past middleware; it does not authenticate a user or grant editorial access.
- Source commits: middleware `0b80277`; staging callback smoke `bf0d41f`.
- The workflow is configured for pushes to `refactor/factsport-v2` and manual dispatch. This record does not claim its run passed until exact run/head evidence is checked.

## Current status and limits

The configured Entra staging start/PKCE smoke and prior protected staging/PNG smoke passed on earlier recorded SHAs. They do not verify this new callback smoke, a real Entra authorization-code exchange, the user's exact issuer/subject link, active editorial membership, authoring/publish/unpublish/logout, or the reported deployed-browser result.

The staging gate still exposes only the documented Media sign-in routes without the temporary CI token; all other staging routes remain gated. Production DNS, Worker routes, secrets, database, schedules, AdSense, Logic Apps and legacy services were not changed.

## Next implementation/acceptance order

1. Confirm isolated verification and protected staging on the source commit containing M82; inspect the job summary and exact `head_sha`.
2. Re-test the actual Factsport External ID sign-in in staging. If the callback passes middleware but ends at the generic login error, inspect redacted Worker error class/status and the owner-approved issuer/subject mapping; do not log authorization codes, state cookies, tokens or session secrets.
3. Complete the staging editor journey: sign-in, exact identity lookup, active Media membership, role-denial checks, draft/review/publish, public canonical/share-card, unpublish and logout. Keep accounts manually linked; never auto-link by email.
4. Complete the remaining M74 public-page/share formats, responsive/accessibility/crawler/rights acceptance and M77 public sports lifecycle. Rehearse V2-target backup/PITR restore and rollback.
5. Only then assess P9A route isolation and obtain its explicit go/no-go. Keep P9B identity/business rules and P10 TV sequenced separately; do not enable the disabled Logic App or introduce unapproved services.

No P9A/P9B/P10 acceptance item is closed by this middleware change.
