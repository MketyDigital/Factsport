# TV-001 — Factsport TV V2 implementation sequence

Date: 2026-11-16  
Branch: `refactor/factsport-v2`  
Status: active Media-phase V2 workstream, owner-directed 2026-11-23. Evidence-backed planner, rights-gated self-contained SVG scene-frame renderer, 15-second synthetic H.264 preview compiler, server-only YouTube resumable-upload adapter, and protected read-only storyboard prototype are implemented. Full episode rendering/audio, durable studio/outbox, non-YouTube dispatch and staging acceptance remain open. Production uploads still require rights, OAuth, platform and editorial gates.

## Source of truth

The full product contract is [`docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`](../product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md). This document turns that spec into V2 work stages. The spec is design approved in principle, not evidence of code, licensed inputs, staging acceptance, or production approval.

## Product boundary and order

Factsport TV is an internal modular subsystem of Factsport V2, delivered in the Media phase. The scoped `factsport.com` Media/TV release may preserve the current `predict.factsport.com` service and free-play flow; the broader Predict product migration has a separate later P9B gate. No release changes the Predict route, cookies or API without its own staging acceptance and go/no-go. Keep existing V2 architecture, canonical match IDs, Azure PostgreSQL via Hyperdrive, R2, replaceable adapters, and Media ownership boundaries.

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

#### Implemented renderer slice (2026-11-23)

- `lib/tv/svg-scene-renderer.mjs` compiles a `draft` `MatchStoryPlan` into self-contained 1920×1080 SVG frames for opening, lineup, clearly disclosed illustrative event, verified-statistics and closing scenes. It consumes the planner's verified facts; it does not fetch feeds, create match evidence, copy footage, or publish content.
- The renderer rejects plans without a draft state, cleared data/assets rights, verified timestamped facts, known fact references, valid score text and required illustration disclosure. All dynamic text is XML-escaped and frame output contains no remote asset references.
- `scripts/render-tv-preview.mjs` composes the synthetic plan through SVG frames, Resvg PNG rasterization, gentle FFmpeg zoom/fade motion and H.264 encoding. It produced a local 15-second 1920×1080, 25fps sample with explicit synthetic/nonpublishable labels. The sample has no audio and is not a real match episode. This remains a prototype, not the proposed full Blender/Three.js render pipeline, four-minute director, narration/audio/captions, durable R2/job pipeline or social publisher. The output still needs visual/audio QC and human approval; TV4–TV5 gates remain open.
- `tests/tv-svg-scene-renderer.test.mjs` covers output dimensions, source-digest labeling, escaping, disclosures, rights, missing/unverified facts and the offline video script boundary. The protected `/admin/tv` storyboard embeds generated SVG frames beside its synthetic visual samples; it remains a read-only preview and was not browser-accepted as a real editor journey. Exact head `e89103f4a7c3b21395ddc49aeb1106e1ac942a8b` passed the 309-test regression suite, TypeScript, native build and protected staging (runs 45271817408, 45271817531, 45271817645).

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

## 2026-11-23 — protected storyboard prototype

- Added `/admin/tv` inside the existing authenticated Media workspace. It is noindex and read-only; the preview makes no match-feed, rendering-job, storage, or social-account requests.
- Added selectable abstract scenes: CSS-perspective stadium opener, a clearly marked example 2D formation, an illustrative action disclosure, unknown-safe statistics, and an outro. The page explicitly says it is not publishable and includes the current renderer, rights, OAuth, and outbox readiness gaps.
- This is a visual design prototype, not a video renderer or publishing outbox. It does not establish source licensing or authorize a social post.
- Exact head `e86690f8488dbf25534eda60864e49a12929852c` passed isolated verification [45220923630](https://github.com/MketyDigital/Factsport/actions/runs/45220923630), native Cloudflare build [45220923394](https://github.com/MketyDigital/Factsport/actions/runs/45220923394), and protected staging [45220923298](https://github.com/MketyDigital/Factsport/actions/runs/45220923298). The TV page is deployed but not yet browser-reviewed with an authorized editor session.

## Related gates

- Roadmap: `docs/audit/ROADMAP.md` M78
- Release plan: `docs/audit/PRODUCTION-EXECUTION-PLAN.md` P9A/P9B/P9C/P10
- Product spec: `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md`
- Core public Media acceptance remains P0–P3 and M74/M75; Prediction remains P4–P6. TV is developed concurrently; final cutover waits for all three tracks.


## 2026-11-24 — caption provenance primitive

- Added `lib/tv/captions.ts` to package human-authored narration as plain-text WebVTT with a cue-to-verified-fact provenance map.
- The builder rejects missing/unverified evidence, malformed or overlapping cue timing, duplicate IDs, unsafe VTT markup/control text, empty captions, and cues beyond the episode duration. It does not generate narration from events.
- This is an offline library primitive only. It is not wired to the Studio or persisted in R2/outbox yet, and it does not establish audio generation, subtitle synchronization or production acceptance. Verification remains open.


## 2026-11-24 — durable episode schema and publish guard

- Added migration `0051_factsport_tv_episode_workflow.sql` for private episodes, snapshots, scenes, R2 asset lineage, leased render jobs, human approvals, publish outbox, attempt records and audit events.
- Added migration `0052_factsport_tv_publish_approval_guard.sql`. The outbox refuses enqueue unless the episode revision is approved, the same actor has a publish approval, a current rights approval exists, and a cleared video asset is recorded. It makes approved package fields immutable and narrows dispatcher updates to delivery state/receipts.
- The staging migration workflow ledger expectation includes versions 0–52. Guarded run [45319655896, attempt 2](https://github.com/MketyDigital/Factsport/actions/runs/45319655896) succeeded against the isolated `factsport_v2` database via the temporary migration Worker and applied two forward migrations, ending at version 52 of 52. No production database, renderer worker, social account, schedule, or post was changed.
- Schema is not yet integrated with API routes, R2 signed assets, job workers, editor screens or provider dispatch. The migration chain passed disposable PostgreSQL verification on run [45319638874](https://github.com/MketyDigital/Factsport/actions/runs/45319638874); isolated verification at source `3e5f742` passed on run [45320132831](https://github.com/MketyDigital/Factsport/actions/runs/45320132831). Native build and protected staging preflight at that exact source are still running; no app/API integration is claimed.

- Added a dedicated `tv` capability to the existing Entra-backed Media editorial authorization map for editor, publisher and media-admin roles. TV APIs/screens still need to call it; this does not grant membership or complete the owner’s editor journey.


## 2026-11-24 — private episode inventory slice

- Added `GET /api/admin/tv/episodes`, protected by the dedicated Entra-backed `tv` capability and the V2 editorial PostgreSQL binding. It returns at most 100 private episode summaries with `Cache-Control: private, no-store`; it performs no match-feed, write, render or publishing action.
- Connected the storyboard workspace to this endpoint with explicit loading, denied, unavailable and empty states. The fictional SVG sample remains labeled as a disconnected, nonpublishable preview.
- This is inventory-only: episode creation/editing, frozen canonical match snapshot reads, R2 signing, render orchestration and authenticated browser acceptance remain open.


## 2026-11-24 — rights-gated Match Story draft entry

- Added a bounded, Entra-protected final-match picker over canonical V2 `matches` and a same-origin episode-create action. The server re-reads and locks the match, rejects non-final or missing-score data, generates a deterministic source-linked score plan, and idempotently stores a private episode plus audit event.
- New drafts always start `blocked_rights`, with data and asset rights set uncleared, script/audio not started, and no render job or publishing action. The route stores no provider event prose, calls no upstream provider, and never invokes social upload code.
- The TV workspace now has final-match selection, draft creation, and persisted episode inventory. It still needs active TV membership on the already registered Entra identity; no new signup is part of this work.
- Exact-head isolated verification `1b83e87` passed [45321681478](https://github.com/MketyDigital/Factsport/actions/runs/45321681478). Native build and protected staging preflight are still running. Authenticated owner browser acceptance remains open.


## 2026-11-24 — evidence-linked script draft editor

- Added private episode-detail GET and same-origin PATCH routes. The editor loads only verified facts and rights state, then saves original narration blocks only when each block references at least one verified fact from that frozen episode.
- Script text is plain text, bounded to 40 blocks/10,000 characters, version-checked against `updated_at`, and recorded in the audit log with a content digest. The save does not advance episode status, clear rights, enqueue rendering, generate audio or publish.
- Added a workspace editor with per-block source selection and explicit rights-blocked state. It remains a draft editor; review approvals, rights evidence decisions, narration QA, captions/audio sync, rendering and publishing remain separate gates.
- Exact-head isolated verification `3c3b110` passed [45323117266](https://github.com/MketyDigital/Factsport/actions/runs/45323117266). Native build and protected staging preflight are still in progress.


## 2026-11-24 — script review and persisted storyboard draft

- Added an independent editorial review endpoint and Studio controls. A different TV editor must approve the saved script digest; review records are tied to the episode revision and audited. Editing the script clears the prior review and deletes any storyboard scenes.
- Added a protected storyboard builder. After the current digest has independent approval, it deterministically creates one source-linked 2D fact-card scene per narration block, with estimated text timing and no external asset references. Scenes are stored in the isolated TV scene table and returned by the protected episode-detail API.
- The storyboard is still a text-only editorial plan: no image, footage, voice, audio, video render, render job, rights change, status advancement, or platform upload occurs. Rights remain blocked. A real authorized browser journey and exact-head staging acceptance are still required.
- Exact source head `aa0a5e9` passed isolated verification [45324494210](https://github.com/MketyDigital/Factsport/actions/runs/45324494210), native Cloudflare build [45324494239](https://github.com/MketyDigital/Factsport/actions/runs/45324494239), and protected staging preflight [45324494220](https://github.com/MketyDigital/Factsport/actions/runs/45324494220). The staging run passed its deny-by-default deployment check; it did not perform an authenticated editor browser journey.


## 2026-11-24 — animated storyboard scene preview

- The Studio now presents the selected persisted scene in an animated, responsive 2D/2.5D broadcast-style concept panel with source-backed fact cards, approximate timeline, scene selection and previous/next controls.
- Motion respects reduced-motion preferences. Abstract pitch styling is explicitly labeled as illustrative; there is no match footage, player likeness or event recreation. The view remains a private editorial preview and does not create an asset, render job, media file, or publishable output.
- Exact source head `454c932` passed isolated verification [45342942972](https://github.com/MketyDigital/Factsport/actions/runs/45342942972), native Cloudflare build [45342942964](https://github.com/MketyDigital/Factsport/actions/runs/45342942964), and staging deploy/deny-by-default checks [45342943031](https://github.com/MketyDigital/Factsport/actions/runs/45342943031). The real authenticated browser review and rights/render/publishing gates remain open.


## 2026-11-24 — fact provenance in scene preview

- Each storyboard preview fact now shows its source and observation timestamp beside the fact text, in the private concept scene and persisted scene list. Reviewers can inspect claims and provenance together.
- Exact source head `3f0d6c6` passed isolated verification [45343476559](https://github.com/MketyDigital/Factsport/actions/runs/45343476559), native Cloudflare build [45343476547](https://github.com/MketyDigital/Factsport/actions/runs/45343476547), and protected staging [45343476525](https://github.com/MketyDigital/Factsport/actions/runs/45343476525). This remains an editorial preview, not a final video or publishing approval.


## 2026-11-24 — private 3D model intake

- Added `factsport_tv_asset_library` and episode-to-model links in migration `0053_factsport_tv_model_asset_library.sql`. Guarded staging migration run [45353663369](https://github.com/MketyDigital/Factsport/actions/runs/45353663369) verified database `factsport_v2` with the complete 54-entry ledger through version 53; disposable PostgreSQL migration verification [45353666408](https://github.com/MketyDigital/Factsport/actions/runs/45353666408) passed.
- Added protected model inventory, private original retrieval, and upload APIs. Upload accepts self-contained glTF 2.0 `.glb` files up to 32 MiB, rejects external file references, hashes the file, stores it under the private R2 `tv/models/` prefix, and records uploader-reported provenance. The Studio upload form links a model to an episode and labels rights as pending; no render or publication path uses it.
- Exact source head `cb2d13a` passed isolated verification [45354250796](https://github.com/MketyDigital/Factsport/actions/runs/45354250796), native Cloudflare build [45354250921](https://github.com/MketyDigital/Factsport/actions/runs/45354250921), and staging [45354251013](https://github.com/MketyDigital/Factsport/actions/runs/45354251013).
- License review identified Quaternius' [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) (CC0, glTF) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (CC0, GLB) as options for clearly generic, non-identifiable players and locomotion. Use only individual assets whose included license file agrees with the source page; do not imitate a real player. The owner's stadium is not attached and its source page is not yet known, so it remains pending and is not cleared for a public render.
- Limitation: the upload is currently capped at 32 MiB; larger models need optimization/export to GLB or a resumable multipart upload increment before intake.

## 2026-11-24 — independent model rights review

- Added a separate `rights_admin` capability for GLB review. The uploader cannot review their own asset; clearing requires a named license, an HTTPS source or license evidence URL, and a written review note. Evidence links are recorded but not fetched by the application.
- Decisions (`cleared`, `restricted`, `revoked`) are persisted with reviewer, timestamp, evidence and an audit event. Revocation is terminal for that asset version. A cleared model does not bypass episode, render-QC or publication approval.
- The Studio presents the review form only to media admins. Staging acceptance still needs a different authorized reviewer and actual source/license evidence.


## 2026-11-24 — procedural 3D look-dev proof

- Added `scripts/render-tv-blender-proof.py` and rendered a visually inspected, 3-second 960×540 H.264 proof with Blender 4.3.2 and FFmpeg. The scene has an original procedural stadium, pitch, goal frames, rolling generic football and cinematic camera movement; no downloaded models or real-match inputs are used.
- The clip labels itself fictional and illustrative, includes no real team/player likeness or footage, and is not publishable. It has no narration, music or captions and is only a look-dev proof, not the target 3–5 minute render pipeline.
- The owner's stadium `.glb` still must be uploaded with its source and license evidence. The active Studio upload limit is 32 MiB; the next renderer work must replace/augment this procedural bowl only after that model is independently cleared.
- Exact head `2639d84a83d817f6ae7968afce8f2377a5df1357` passed isolated verification [45358005169](https://github.com/MketyDigital/Factsport/actions/runs/45358005169), native build [45358005177](https://github.com/MketyDigital/Factsport/actions/runs/45358005177), and protected staging [45358005256](https://github.com/MketyDigital/Factsport/actions/runs/45358005256). Staging deployment/preflight is not a substitute for a signed-in studio browser session or episode-level asset review.

## 2026-11-24 — resumable large-model intake (working tree; not yet staging-accepted)

- Extends private model intake to 512 MiB through Cloudflare R2 multipart upload, using 16 MiB parts and owner-bound resumable sessions. The editor reuses completed parts after interruption, retries each part, verifies the GLB header and stores the model privately. The digest is explicitly scoped to the ordered part manifest, not misrepresented as a full-file SHA-256.
- The upload remains rights-pending, has no rendering integration and cannot publish content. The 300–400 MB owner stadium fits this size limit; the model has not yet been received or reviewed.
- Local TypeScript typecheck passed for this working-tree change. Disposable PostgreSQL migration verification, Cloudflare build, migration 0054 staging application, and signed-in editor acceptance are still required before relying on this workflow in the deployed studio.
- Factsport TV's role and current-vs-planned capabilities are documented in `docs/product/FACTSPORT-TV-MEDIA-ENGINE-SPEC.md` under “What Factsport TV is for, and how an editor uses it.”
