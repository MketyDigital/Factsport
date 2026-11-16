# TV-001 — Factsport TV V2 implementation sequence

Date: 2026-11-16  
Branch: `refactor/factsport-v2`  
Status: integrated design plan; **implementation intentionally deferred until public Media and Prediction cutover phases are complete and stable**.

## Source of truth

The full product contract is [`docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`](../product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md). This document turns that spec into V2 work stages. The spec is design approved in principle, not evidence of code, licensed inputs, staging acceptance, or production approval.

## Product boundary and order

Factsport TV is an internal modular subsystem of Factsport V2. It follows the public Media release and the separate Prediction/business release, and must not block either. It does not become a standalone app or a new company. The current release order is: public Media → eligible Media-only cutover → Prediction/business → Factsport TV. Keep existing V2 architecture, canonical match IDs, Azure PostgreSQL via Hyperdrive, R2, replaceable adapters, and Media ownership boundaries.

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

- Define typed `MatchVideoSnapshot`, canonical event identity, freshness/rights qualifiers, frozen source digest and `EpisodePlan`/scene schema in `app/lib/tv` only after design review.
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

- Roadmap: `docs/audit/ROADMAP.md` M78
- Release plan: `docs/audit/PRODUCTION-EXECUTION-PLAN.md` P9A/P9B/P9C/P10
- Product spec: `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`
- Core public Media acceptance remains P0–P3 and M74/M75; Prediction remains P4–P6. TV code does not begin until those preceding phases are released and stable.
