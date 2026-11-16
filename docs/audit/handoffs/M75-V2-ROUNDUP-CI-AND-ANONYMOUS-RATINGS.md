# M75 — Consolidation: V2 CI recovery, no-D1 fan ratings, release-truth roundup

Date: 2026-11-16
Branch: `refactor/factsport-v2`
Status: CI-backed code remediation + account-free ratings source and tests committed. **Not a production cutover**, and not a claim that all V2 features have completed staging acceptance.

## 1. Scope, architecture and owner guardrails

Factsport.com **Media is the primary product**; `predict.factsport.com` remains separate Prediction infrastructure and entitlement/registration. Public Media chat, MOTM and fan ratings must not require accounts/email/Prediction membership. Use signed HttpOnly visitor cookies, server-side Turnstile, canonical match ID and PostgreSQL, not active D1. The owner expressly rejected paid Cloudflare Stream VOD. Preserve Stream.io live studio, ESPN-first fast viewer, FD canonical database reconciliation, rights-aware media, newsroom dual-review, social outbox, and AdSense-readiness policy.

This handoff consolidates M70-M74 and actual GitHub Actions evidence. It does not override `docs/audit/ROADMAP.md` or `PRODUCTION-EXECUTION-PLAN.md`; those remain authoritative.

## 2. Concrete CI failures identified and resolved

On M74's source handoff commit `9f82f3e`, isolated verification `43867101665` failed 6/270 tests. Read the actual GitHub job logs, not Vercel pending status:
- AdSense public Media test still expected the old live-reader symbol rather than `listPostgresLiveCoverageWindow`.
- AdSense chat test still expected a development-only flag, conflicting with the owner's M73 feature-gated anonymous PostgreSQL chat.
- Editorial CMS test demanded `previewVideos` and `<MediaVideoPreview />` even though paid Cloudflare Stream VOD preview is explicitly disabled by M53. Revision video/source metadata summaries remain available.
- Two live-score tests unintentionally sliced an entire adapter (or adjacent doc comments), treating permitted rights-protected media read-model fields outside the **score-only** SQL function as leaks.
- Match compatibility test banned the word `predictor` from all public match reads. The public football predictor percentages are legitimate Media match data; VIP prediction/settlement records remain excluded.

Updated the tests to assert the **actual** narrow reader/server authorization boundaries and retained checks for scoring, rights provenance, no private playback leakage, and Prediction isolation. A follow-up issue surfaced with a runtime-evaluated TypeScript helper in `tests/media-legacy-source-security.test.cjs`, updated to its current checked source signature.

GitHub isolated verification on commit `eb228e890bd27470a133fa2552f2741db3b2f12a` succeeded (run `43870176745`), as did native Vinext build (run `43870176596`). They cover the CI remediation, before the later rollback-only player-rating acceptance SQL and final M75 docs. Newer GitHub checks must be read and recorded separately; do not attribute those earlier passes to the eventual head.

### TypeScript remedial changes

`app/admin/news/actions.ts` stopped using ES2015 spread over `Set` under the existing TS target, and now checks the PostgreSQL result record's external-video fields via explicit runtime string guards, preserving rights attestation. `lib/media/anonymous-community-visitor.ts` removed disallowed Uint8Array direct iteration. TypeScript/build passed on the referenced `eb228e89` run.

## 3. Additional no-D1 audit finding and implementation

The match Stats/Starting XI tab still loaded `app/components/PlayerRatingsWidget.tsx`, which directly fetched and posted to `https://fse.mkpoikankes.workers.dev/api/ratings`. That external Worker was **not** disconnected by M70's chat/MOTM changes, and the widget optimistically saved ratings to `localStorage` before checking HTTP success. This is a genuine active V2 legacy integration risk and a false-success UI bug.

Implemented instead:
- Migration `db/migrations/0048_factsport_media_guest_player_ratings.sql`: private rating table with canonical match ID, anonymous visitor FK, `UNIQUE(match_id,visitor_id,player_name)`, 6–10 scoring matching legacy UI options, public totals-only view, anonymous function-only role execution. Server function verifies completed match within 24 hours of kickoff, canonical legacy alias, authentic starting lineup, visitor suspension and network rate limits.
- `GET/POST /api/media/ratings`: read totals via dedicated PostgreSQL reader, POST via isolated community Hyperdrive/role, strict JSON shape, signed cookie identity, server-side Turnstile action `media-rating`, exact duplicate response (409) and abuse throttling; writes default off.
- `GET /api/media/ratings/state`: only current signed visitor's earlier player ratings, without accounts or exposing others' identities. Initial GET issues the signed HttpOnly cookie.
- `PlayerRatingsWidget.tsx`: replaces all D1/old external Worker fetches; no `localStorage` authority, does not claim success until HTTP acceptance, uses 2D/2.5D cards and verified average score, Turnstile reset on attempts, protected pre-submit state and accessible names. Shows honest unavailable notice while disabled.
- `StatsLineupsTabs.tsx`: supplies canonical stored kickoff time, so the feature does not guess from missing live response fields.
- `tests/media-player-ratings-no-d1.test.cjs`: explicit source invariants, migration/role, public vs private projections, no D1, auth-free/staged vote paths.
- `tests/sql/media-player-ratings-acceptance.sql`: **rollback-only isolated staging** check for canonical alias, registered-user independence, duplicate player votes, bench rejection, aggregate and cookie-backed state. No database query or migration was executed by this work.

The original external rating Worker source/config has **not** been verified in the owner-uploaded `workerfse` or `workerchatfs` files; M75 preserves the visible legacy UI scoring behavior (6–10, FT, 24h) but does not claim parity with any additional unknown deployed rating Worker logic.

## 4. Current progress by product

| Scope | Source state | Activation / blockers |
|---|---|---|
| Core Media and homepage/fixtures/standings | PostgreSQL reader migration paths, M74 visual cards and social standings OG | Full route/every-tab browser, source parity and protected staging still needed |
| Fast ESPN match viewer | Exact archived worker mapping, canonical ID same-origin 3-second route behind flags, no D1 | Provider load, cache/TTL, real score accuracy and flag activation not verified |
| Newsroom/rights/AdSense | Dual-review, sanitized embeds, asset attestation, social outbox and rights controls in branch | Real users/providers, consent/CMP and rollout proof still required |
| Stream.io live studio | Separate signed token/room/webhook controls in branch | Real staged room, identity and webhook validation needed |
| Chat/MOTM/ratings | Guest signed cookie, Turnstile, PostgreSQL schema/functions and partial safe UI source committed | Migrations 0044-0048, separate role/Hyperdrive, Turnstile keys and staging abuse tests not executed |
| Prediction and free entry | Separate legacy parity/migration architecture and consent design | DB scoring parity, authentication, entitlements, settlement and production cutover not signed off |
| Social OG | Existing versus/pitch engine + M74 standings branded card; rights and SEO controls | Real Edge OG render/crawler tests and remaining article/FT/MOTM templates pending |

## 5. Exact release blockers and next actions

1. **Finish latest CI checks** after new M75 ratings source, tests and documentation; require green test:engine, typecheck and Vinext. Investigate any new failures in exact GitHub job logs; legacy Vercel status is not the V2 deployment gate.
2. Apply reviewed PostgreSQL migrations **0044–0048 in isolated `factsport_v2` staging only**. Run rollback-only SQL acceptance, role grant/denial tests, full row integrity, data retention and adversarial network/visitor cookie reset probes. Verify role inheritance and Hyperdrive privileges, especially `NOINHERIT` role vs login.
3. Provision approved separate community Hyperdrive login and Turnstile staging widget/secrets, with backend and frontend feature flags explicitly opt-in. Keep no accounts, no D1, no Prediction-linked marketing emails for Media community.
4. Audit all app/runtime Worker URLs and browser endpoints for residual D1-backed dependencies, including dormant/off-flag code; replace or fail-close with logged feature state.
5. Continue M74-A–E visual rollout on all Media and match-detail tabs, article/social templates; measure actual device screenshots, accessibility, crawlable 1200x630 previews, rights provenance, cache and Core Web Vitals.
6. Do end-to-end real ESPN/FD/Stream.io/editorial/social and Prediction score/entitlement parity; check real Azure PostgreSQL migration, Cloudflare protected staging, site indexing/AdSense and owner approval before any production cutover.

## 6. Rollback / no-production affirmation

Individual source commits can be reverted safely on V2. **M75 migration is not applied**; eventual DB rollback after live votes requires a separate retention-safe strategy, not DROP TABLE. The historical owner-uploaded D1 scripts remain reference-only. No production D1, database writes, DNS, paid Cloudflare Stream, billing, ad activation, or production deployment was intentionally performed during M75 remediation. Protected staging workflow may auto-run from branch pushes and is tracked separately; not evidence of production deployment.

## 7. Protected Cloudflare staging deployment failure diagnosed

GitHub full application staging run `43870292345` **passed engine tests, TypeScript and Vinext build**, then failed during its deploy step. Exact error: `Build Output Specification: no root config found at .cloudflare/output/v0/config.json`. The Vinext Vite build produced `.cloudflare/output/v1/` but `cf deploy --prebuilt` expected v0. This is a **staging pipeline/build-output mismatch**, not evidence that the Cloudflare API token or Cloudflare 2FA is invalid.

The next source fix removed `--prebuilt` from the protected staging workflow and used the documented `cf deploy --mode production --secrets-file /tmp/factsport-staging-secrets.json` so cf performs the supported build-and-deploy flow with a single temporary staging access secret. Commit `abfcaab2773a92f43d1df5a20b05514595a61e98`. Official current documentation: https://developers.cloudflare.com/cf/projects/ and https://vinext.dev/docs/deploying/cloudflare.

**This workflow is not proven fixed until the latest GitHub staging run completes successfully**, including deny-by-default path checks. No production routes, DNS, D1 or billing settings were modified.

## 8. Final protected staging evidence (do not claim staging pass)

GitHub protected staging run `43871102395` on `abfcaab2` also **failed** after tests, TypeScript and Vinext build had completed. Removing `--prebuilt` was insufficient: `cf deploy --mode production --secrets-file` still expected `.cloudflare/output/v0/config.json` while `vite build` generates `.cloudflare/output/v1`. The temporary secret was kept in the CI environment and the deployment did not reach the HTTP deny-by-default check. **Do not claim staging deployment, public page/browser acceptance or activation.**

The correct next engineering action is a compatibility-focused Cloudflare CLI/Vite plugin/Vinext package investigation using supported matched releases and an isolated `cf deploy --dry-run` before any protected deploy. Do not symlink v1 output into v0 or blindly fabricate config. Source docs: https://developers.cloudflare.com/cf/projects/ and https://vinext.dev/docs/deploying/cloudflare. Commit of the failed attempt: `abfcaab2773a92f43d1df5a20b05514595a61e98`.

Latest isolated source CI at documentation commit `b6186b637a019fee351f92167f9bdc66b5e73a36` succeeded in workflow `43871256189`. The last directly observed native Vinext build success on ratings code was at `5508ff9aacbd3584e4b81271c0d563a9c5b07b8f`, workflow `43870292428`. Later docs/workflow commits do not change application source; this does not prove any future migration or Cloudflare deploy.

Focused browser-component source scan included `FanZoneChat`, `MOTMVoteWidget`, `PlayerRatingsWidget`, `ScoreAxisWidget`, `MatchRow`, `MatchHeaderClient`, `HeroMatchCards`, `CompactMatchRow`, `MatchMobileHub`, `LiveScoreLabel`, `HomeDashboardClient`, `LiveMediaClient`; no hardcoded legacy D1 Worker hostnames in those files. This is a **focused** scan, not a claim of exhaustive branch-wide verification.
