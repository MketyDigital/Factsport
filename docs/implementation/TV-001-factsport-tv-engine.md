# TV-001 — Factsport TV V2 implementation sequence

Date: 2026-11-16  
Branch: `refactor/factsport-v2`  
Status: active concurrent V2 implementation track, owner-directed 2026-11-23. Evidence-backed planner, server-only YouTube resumable-upload adapter, and protected read-only storyboard prototype are implemented; renderer, durable studio/outbox, non-YouTube dispatch and staging acceptance remain open. Production uploads still require rights, OAuth, platform and editorial gates.

## Source of truth

The full product contract is [`docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`](../product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md). This document turns that spec into V2 work stages. The spec is design approved in principle, not evidence of code, licensed inputs, staging acceptance, or production approval.

## Product boundary and order

Factsport TV is an internal modular subsystem of Factsport V2. It is a required concurrent workstream tracked alongside public Media and the Predict product; it is not a post-cutover afterthought or standalone app/company. The final V2 cutover waits for Media, Predict and TV acceptance plus rollback evidence. Keep existing V2 architecture, canonical match IDs, Azure PostgreSQL via Hyperdrive, R2, replaceable adapters, and Media ownership boundaries.

## Implementation stages

### TV1 — rights and input feasibility

- Obtain written review of ESPN/provider contractual rights for commercial reuse of structured data, plus logos, photos/footage, kits, stadiums, player likenesses, voice, music, fonts/models, AI model weights and YouTube policy.
- Confirm feed samples and required fields for league, cup, extra-time, penalties, VAR, corrections, sparse/no-lineup/no-stat and abandoned/postponed matches. Do not infer event/asset rights from API access.
- Measure local render compute, storage, output bandwidth and retry costs; no “free to run” claim.
- Keep production publishing and schedule credentials absent.

### TV2 — offline Match Story prototype

- Use deterministic sanitized fixture JSON and original or explicitly rights-cleared artwork/voice only. Do not connect production ESPN, legacy Supabase, YouTube upload or public website.
- Generate nominal four-minute 16:9 Match Story, responsive down to a shorter 3–5 minute story without padding; produce 9:16 derivative only after landscape QA.
- Use Blender + Three.js + FFmpeg as the proposed free/open-source default subject to license review; alternative Remotion is optional and requires eligibility/licensing review.
- Trace every narration fact to snapshot data or a human assertion; no copied ESPN prose, invented passes/locations/assists, fabricated stats, or realistic replay presented as footage. Label illustrative actions clearly.
- Gate unsupported interpretation to human editor; 2D is used when 3D would mislead or not improve clarity.

### TV3 — data and episode contracts

- Define typed `MatchVideoSnapshot`, canonical event identity, freshness/rights qualifiers, frozen source digest and `EpisodePlan`/scene schema under `lib/tv` as the current offline implementation slice.
- Build a read-only SportsReadAdapter over canonical V2 read models. No renderer direct ESPN calls, legacy DB, Supabase or duplicate match store.
- Add RightsAndProvenanceGate, original-language/narrative check, source-freshness checks, data conflict handling and deterministic quality state.
- Add table-driven golden tests for gaps, late/duplicate/corrected events, own goals, VAR, extra time, penalties, status changes, provider outages and match ambiguity.

### TV4 — isolated editor and durable render pipeline

- Add reviewed migrations for TV-specific episode, scene, asset lineage, render-job, QC, approval and publish-outbox state. Add distinct least-privilege API/worker roles; no admin DB credential in the app. Do not apply to production.
- Add human editor-only Studio routes, audit log, script/scene/timing/narration/music overrides, signed previews, QA review and cancellation/retraction workflow. Require human approval for every initial episode.
- Store snapshots, drafts, outputs, captions, posters and manifests in private R2 through MediaStore; define retention and safe deletion.
- Use durable job lease/idempotency/retries and external render compute (local/self-hosted by default). Cloudflare Worker handles orchestration and delivery, not GPU rendering or long encoding requests.
- Keep YouTube and other publishing credentials out of scope until explicit owner approval; validate private/unlisted upload only with test account after channel OAuth, policy and licensing review.

### TV5 — staging acceptance and later activation gate

- Run security, roles, privacy, output QC, accessibility, provenance, factual integrity, cost, resilience, retry/reconciliation, deletion and performance tests.
- Independently review scripts/video and licensing for each show format. Match Story ships first; Daily, Weekend and Monday directors are separately gated based on complete sources and human staffing.
- Keep trigger schedules off. No automatic public uploads, YouTube publishing, public TV page, production ingest or new recurring provider calls without a separate TV production go/no-go.

### TV7 — human-reviewed social publishing path

- Build draft packages for YouTube landscape and vertical social derivatives, including original title/description/captions, provenance and disclosure fields, and a review state.
- Record explicit per-platform approval and publish receipt/idempotency references in a durable outbox before connecting dispatchers.
- Start publishing as soon as the owner-selected channel OAuth, cleared episode rights/assets, channel policy checks, and human review are available. Never auto-mass-post or expose credentials in browser code.
- YouTube adapter primitives use the resumable `videos.insert` flow, request private visibility first, and carry the synthetic-media disclosure flag when applicable. OAuth refresh token and client credentials are runtime-only inputs; resumable session URLs are secret and must stay server-side. No dispatcher or production OAuth connection is currently enabled.
- TikTok adapter can request an inbox draft by verified-domain pull transfer only after explicit upload consent, rights clearance and human episode approval; the creator completes publishing in TikTok. TikTok developer registration, scope approval, OAuth, verified Factsport URL prefix and a TV MediaStore signed-asset endpoint are still required.

## Acceptance for initial staging build

- Deterministic golden render with source-linked facts and stable digest.
- Zero unsupported asserted facts; missing data omitted or clearly qualified.
- Illustrative 3D marked where it could be mistaken for real play; no copied commentary or unlicensed asset.
- Human overrides and dual-review decisions auditable and survive retries.
- Private drafts and signed previews; correct retention, access control and revocation.
- Reproducible failure/retry behavior without duplicate publish intent; cost per episode measured.
- All product flags/schedules remain off after staging.

## Explicit non-goals / prohibited carryover

- Do not use paid Cloudflare Stream hosted VOD; this is distinct from approved Stream.io live workflows and R2 image/video storage decisions.
- Do not use direct ESPN requests in renderer, legacy Supabase history or any independent match database.
- Do not invent missing lineup, stats, formations, player positions, assist, trajectory, ratings or league table effects.
- Do not mass-generate repetitive videos or publish automatically before separate written approval.
- Do not treat open-source software as free compute/bandwidth, or assume commercial license for data, assets, voices or models.

## Related gates

## 2026-11-23 — protected storyboard prototype

- Added `/admin/tv` inside the existing authenticated Media workspace. It is noindex and read-only; the preview makes no match-feed, rendering-job, storage, or social-account requests.
- Added selectable abstract scenes: CSS-perspective stadium opener, a clearly marked example 2D formation, an illustrative action disclosure, unknown-safe statistics, and an outro. The page explicitly says it is not publishable and includes the current renderer, rights, OAuth, and outbox readiness gaps.
- This is a visual design prototype, not a video renderer or publishing outbox. It does not establish source licensing or authorize a social post.

- Roadmap: `docs/audit/ROADMAP.md` M78
- Release plan: `docs/audit/PRODUCTION-EXECUTION-PLAN.md` P9A/P9B/P9C/P10
- Product spec: `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`
- Core public Media acceptance remains P0–P3 and M74/M75; Prediction remains P4–P6. TV is developed concurrently; final cutover waits for all three tracks.
