# M78 — Factsport TV integration and phased V2 release sequence

Date: 2026-11-16  
Branch: `refactor/factsport-v2`  
Source spec commit: `c2fe0ab49dad81c3c4fd9c8be4b23e8f8a2805b6`  
Status: plan and roadmap integration only. TV implementation has not started. No production resources changed.

## 1. Source checked

Read the latest branch addition [`docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`](../../product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md), the master roadmap, production execution plan, M44–M77 status and media/prediction handoffs. The TV specification is marked **design approved in principle / implementation not started**. It defines a modular Factsport V2 media-engine subsystem, not a standalone product or a completed feature.

## 2. Owner-directed order

The current release sequence is:

1. Finish public Media/sports routes, editorial and operations acceptance.
2. If the release boundary is proven separable, cut over public Media only while the existing Prediction/VIP/payment routes, databases and jobs stay unchanged.
3. Complete and cut over Prediction/business flows in a separate release phase.
4. Begin Factsport TV implementation after the Media and Prediction phases are stable.

A route inventory must prove that `factsport.com` Media can move without breaking or mutating any not-yet-migrated Prediction route, account, payment, VIP entitlement or scheduled job. If routes cannot be isolated, keep production unchanged and finish the separation first. Media and Prediction each require their own production rehearsal, rollback and explicit written go/no-go. TV requires an additional independent approval; it is not a dependency for either earlier release.

## 3. TV scope to carry into V2

- One reusable engine with four directors: Match Story, Factsport Daily, Weekend Football Review and Monday Team of the Week/Table Changes. Match Story is first and targets an adaptive 3–5 minute 3D-first recap; 2D is preferred where it is clearer or more truthful.
- A canonical read-only V2 sports snapshot, immutable input digest, provider freshness/data-quality flags, rights/provenance gate, human-overridable show plan, editor-reviewed narrative, private drafts, durable render orchestration and approval-only publishing.
- Proposed free/open-source core: Blender + Three.js + FFmpeg, subject to current license and operational review. Rendering compute/storage/bandwidth and AI models may still cost money; optional paid services cannot become a hidden requirement.
- Factsport TV is a Factsport V2 module using canonical match identities and existing approved adapters. No independent match database, renderer ESPN scraping, legacy Supabase or direct commentator text reuse.
- Every spoken fact must be traceable; missing facts must be omitted or qualified. Stylized inferred action must be identified as illustrative, never presented as actual match footage. No unlicensed logos, player likenesses, footage, models, music or voices.

## 4. Explicit open gates

- Rights to commercially reuse ESPN-derived match data and any third-party event feed; software open-source status does not provide sports-data rights.
- Current sampled feed field coverage, event corrections, lineup/stat availability, VAR/extra-time/penalty quality and provenance.
- Rights for visual assets, player/club likenesses, stadiums, narrator, voice models, music, fonts and YouTube use; creator OAuth/publishing policy.
- Verified local renderer licensing, compute, storage, bandwidth, episode cost, quality, retries and deletion behavior.
- TV schema, least-privilege roles, editor/admin access, durable queue, signed R2 review, QC, human approval, correction/retraction and staging E2E.
- Separate TV production schedules, credentials, public TV site integration and uploads must stay OFF until their own go/no-go.

## 5. Records updated

- `docs/audit/ROADMAP.md`: M78 identifies the product spec, intent, nonclaims, order and open gates.
- `docs/audit/PRODUCTION-EXECUTION-PLAN.md`: P9 is split into Media-only (P9A), Prediction/business (P9B), and final legacy retirement (P9C); P10 contains the later TV implementation gate.
- `docs/implementation/TV-001-factsport-tv-engine.md`: staged implementation and acceptance checklist.
- Product requirements remain in `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`.

## 6. Current release position

The latest protected app-staging pass `43888294900` verifies only the protected Worker, Hyperdrive/R2 health and a PostgreSQL `/matches` read path with pagination/cache/auth isolation. It does not satisfy the full P0/P3 Media requirements or P9A. Therefore no Media production cutover is ready now. Prediction staging/cutover and Factsport TV remain later phases. Production DNS, legacy services, bills, credentials and schedules remain unchanged by M78.


## 7. Owner direction update — 2026-11-23

The original sequence above is historical and superseded. Factsport TV is a concurrent required workstream with Media and Predict. Free anonymous prediction remains required on `predict.factsport.com`; M84 only keeps it off the AdSense Media host. Do not cut over production until Media, Predict and TV acceptance and combined rollback gates pass. Current status is tracked in ROADMAP M93 and production-plan P10.
