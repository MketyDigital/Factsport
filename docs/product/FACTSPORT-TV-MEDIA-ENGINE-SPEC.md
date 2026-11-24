# Factsport TV — Media Engine and Match Story Specification
Status: DESIGN APPROVED IN PRINCIPLE / initial deterministic planner and server-side YouTube upload primitives implemented on the V2 branch; full renderer, orchestration, rights and staging acceptance remain open
Date: 2026-11-16
Repository: MketyDigital/Factsport
Working branch: refactor/factsport-v2
Owner intent: Factsport TV as a modular subsystem *inside* Factsport V2, like Sports, Media, Editorial, and Predict; not a standalone company/application.
Authority: product proposal reflecting owner direction. The 2026-11-23 owner clarification makes TV a required concurrent V2 workstream; production activation still follows licensing, identity and publishing gates.

## 1. Product vision and binding decisions
- One reusable Factsport TV production engine, four pluggable show directors: **Match Story**, **Factsport Daily**, **Weekend Football Review**, **Monday Team of the Week / Table Changes**.
- **Match Story** is the first show director. Its primary production requirement is highlight-assisted (Mode B), with data-only (Mode A) as an independent/fallback path and tracked reconstruction (Mode C) as an advanced, separately gated path. Target 3–5 minutes (nominal 4:00), emphasizing 3D where accurate and useful; use 2D for exact charts, pitch overlays and lineups.
- Fully data-backed storytelling rather than repetitive scoreboard slides. A human editor can always override scripts, scenes, player selection, voice, music, timing, graphics and publish decision.
- Default to **free/open-source software** for the core; avoid requiring paid SaaS. Free software does NOT mean free compute, GPU, storage, CDN or AI models. Paid optional integrations behind adapters only.
- Use canonical Factsport match IDs and existing sports database and ESPN/fixture adapters through reviewed read-only contracts. Do not introduce an independent match database or direct ESPN fetch in each render worker.
- Work is to be implemented/prototyped on an isolated V2 staging/test boundary alongside Media and Predict before final V2 cutover. Production ingest automation, public pages, social platform uploads, new schedules and production credentials require rights, platform and editorial gates. Do not mutate legacy systems.
- This document is a product/architecture contract, **not evidence of a finished implementation**.

## 2. Four show directors
| Director | Trigger | Typical runtime | Primary inputs | Human checkpoints |
| --- | --- | --- | --- | --- |
| Match Story | Canonical final whistle + verified result and data readiness | 3–5 min | fixture, lineup/formation, goals/cards/subs, clocks, HT/FT, team stats, standings | unusual events, tactical inference, first publications |
| Factsport Daily | Daily editorial window | 3–7 min | reviewed original editorial, news facts with provenance, fixtures, standings | fact-check news/rumours/injuries, editorial approval |
| Weekend Football Review | Saturday and Sunday, distinct editions | 5–12 min | several finalized matches, standings, team stats, reviewed headlines | choose narrative, avoid duplicate stale clips |
| Team of the Week / Table Changes | Monday after data freeze | 4–8 min | player-level performance statistics with provenance, standings delta, fixtures | final XI, positional balance, ratings and subjective claims |
Do not claim automatic player XI rankings are ready: existing ESPN parser does not establish comprehensive, consistent player performance coverage.

## 2.1 Three production modes — one episode architecture

These are three production modes, not three levels of automation. Each produces the same versioned `EpisodePlan`, scene list, provenance manifest, render job, QC report, approval record and platform package. A single episode uses one primary mode; selected scenes may combine verified data graphics and licensed clips when each scene records its source and visual truth label.

| Mode | Inputs and output | What can be automated | Human work and release gate |
| --- | --- | --- | --- |
| **A — Data-only production** | Frozen, verified match snapshot: score, events, lineups/stats where present, original narration and original/cleared graphic or 3D assets. No highlights required. | Build the rundown, evidence-linked script, 2D graphics, illustrative 3D scenes and format derivatives. | Editor checks story, pronunciation, omissions, rights and finished render. Inferred play/trajectories stay labeled illustrative; it is not archival match footage. |
| **B — Highlight-assisted production (primary requirement)** | Match snapshot plus user/provider-supplied footage whose license explicitly covers editing, derivative graphics/AI processing where used, commercial publication and the intended platforms/territories/term. | Probe/transcode media, suggest candidate moments using synced match events, create draft clip ranges, and generate overlays, narration, captions and 2D/3D transitions. Optional segmentation/tracking assists editors but never establishes identity or event truth by itself. | Editor confirms source rights, timeline offset, clip boundaries, event/player attribution, sound/music use and any AI-assisted masks; then reviews the actual episode. Preserve source footage as an unchanged original and render a separate derivative. Do not generatively change match action or imply generated footage is real. |
| **C — Independent match reconstruction** | Prefer licensed/authorized player-and-ball tracking coordinates with event synchronization; alternatively, licensed video from which a computer-vision pipeline estimates pitch calibration and trajectories. | Detect players/ball, estimate camera-to-pitch transform, track objects, map trajectories to pitch coordinates and animate a generic 3D scene with virtual cameras. | Sports-vision editor corrects track breaks, occlusion, team/identity/ball errors and event alignment. Any failed calibration or low-confidence track blocks the scene or falls back to Mode A/B. Present as a **reconstruction/illustration**, never as recorded replay. Individual real-player identity/likeness is excluded unless separately cleared. |

**Priority and fallback:** Build Mode B as the primary Match Story workflow because licensed highlights are the requested main product. Mode A remains a complete mode and works when rights-cleared highlight footage is unavailable. Do not block Mode A on Mode C computer vision. Mode C starts with an offline benchmark on licensed representative footage or authorized tracking data; it is not a first-release promise.

**Shared scene contract additions:** each source scene stores `mode`, `sourceAssetId` (optional), source in/out timecodes, match-time offset and confidence, rights grant reference, scene type, source/evidence references, visual-truth label, and any `trackingRevisionId`. A render manifest freezes these values with the verified sports snapshot digest. No scene may use a clip or trajectory unless its corresponding rights and quality gates pass.

**Highlight ingest gate:** store the source privately; record who supplied it and a durable grant/evidence record covering commercial editing, platform publication, territory, duration, derivative/AI processing and permitted audio. Probe codec, duration, frame rate, timebase and dimensions; hash the original; reject unsupported or unlicensed media. Platform availability or a public web link is not proof of permission. External AI services must not receive footage unless the specific vendor/data handling is approved; prefer a private/self-hosted vision worker.

**Tracking feasibility gate:** a single broadcast view has pans, zooms, cuts, occlusion and small fast-moving balls. Camera calibration, player tracking, team assignment and jersey identity are separate imperfect tasks. Use official licensed tracking feeds when possible. For video-derived Mode C, store confidence and calibration error per segment, have a human correct keyframes, and block low-quality reconstruction instead of filling gaps with invented movement.

## 3. Match Story: exact reference 4:00 storyboard
| Timeline | Scene | Output | Automation |
| --- | --- | --- | --- |
| 0:00–0:15 | Cinematic opening | 3D stadium intro, branded matchup, correct FT score | automatic |
| 0:15–0:45 | Starting lineups | animated 2D/3D pitch, official starters/formations when available, selected key players | automatic; omit/qualify if missing |
| 0:45–1:10 | First-half story | ordered verified goals, cards and important moments, with original commentary | automatic |
| 1:10–1:25 | Half-time | HT score and verified HT stats only if available | automatic; fallback to score alone |
| 1:25–2:35 | Second-half story | substitutions, goals, equalizers and other decisive timestamped events | automatic |
| 2:35–3:15 | Full-time statistics | possession, shots, shots on target, corners etc. only if reliable | automatic |
| 3:15–3:45 | What decided the match? | evidence-based analysis; explanatory/illustrative tactics | AI-generated draft + editorial review |
| 3:45–4:00 | Closing | FT score, verified league-table implications and Factsport CTA | automatic |
Durations are story templates, not mandatory padding. Adapt when a match has few/many events: default ~3–5 minutes and avoid invented action.

### Narrative and scene rules
1. Every asserted fact links to a canonical field/event with source, observed_at, source_updated_at, and validation state. Render scenes from a **frozen event snapshot** with stable digest/version.
2. Deduplicate goals/substitutions/cards using durable event identities; maintain chronological order, stoppage time, extra time, shootouts, corrections, own goals and VAR reversals without double counts.
3. Use original Factsport language: event facts may be expressed in new prose, but NEVER simply lift ESPN commentary sentences or close paraphrases. Do not pass bulk third-party prose verbatim into narration prompts. Preferred pipeline: extract structured event facts -> validate -> independently write Factsport narrative -> compare for copied phrasing.
4. Event data is NOT positional tracking. A goal with scorer/minute only may create a stylized labelled **illustrative visualization**; never invent a named assist, real ball trajectory, exact shot location, tackle/run or pass sequence. Mark scenes as 'Illustrative visualization — not actual match footage' as needed.
5. No actual television footage, stadium footage, club logos, images, player likenesses, sound effects, tracks or third-party graphic elements without appropriate rights/approved assets. Team/competition names and factual scores are not a blanket license to all associated marks/data.
6. No fabricated injuries, player ratings, tactical explanations or league implications. If unavailable, omit or ask editor.
7. Corrections invalidate or revision the video draft; if already published, create an editorial correction workflow, not a silent re-render/reupload.
8. Explicit provenance, freshness and visual-realism warnings; realistic fabricated match action must not be passed off as a real replay. Follow YouTube synthetic-content disclosure requirements where applicable.

## 4. Data contracts and integration
**Preferred feed path:** existing ESPN live ingestion/Workers -> canonical Factsport sports normalization/read models -> restricted Factsport TV snapshot API -> show director -> render plan; football-data.org remains legacy/V2 fixture/FT support as already approved. The renderer never scrapes ESPN or queries legacy Supabase directly.

Proposed immutable `MatchVideoSnapshot` (logical contract, no production schema changes yet):
- matchId, competitionId, kickoffUtc, status, finishedVerifiedAt, home/away canonical teams, final and halftime score, provider/source/version/freshness
- lineups: players, jersey, starter, formation, completeness flags; absence must not be assumed 4-3-3
- ordered events: canonical id, minute + added time, type, team, player, related player *only when evidenced*, score-after, revision/cancelled/VAR and provenance
- teamStats: normalized name/value/unit with period+source+quality; no invented missing values
- standingsBefore/After with asOf timestamp if trustworthy
- explicit rights flags for every media asset and data field, commentary-derived fact and player representation
- quality flags and missing/contradictory fields; publish eligibility and freeze digest

**Eligibility:** FT verified under sports source-precedence and correction logic; stable canonical ID; no abandoned/postponed/unknown result; required minimum fields present; settle/canonical match provider discrepancies resolved. Do not bind video generation to betting settlement or permit video triggers to cause settlement.

**Staging validation:** inspect real authorized ESPN payload samples from representative league, cup, postponed, goals/VAR, red card, extra time, penalty, no-lineup/no-stats matches. Source code parsing capability is not proof of feed availability or reuse rights.

## 5. Architecture (one engine; four directors)
- `SportsReadAdapter`: read-only canonical events and match snapshot, no direct upstream video fetch.
- `EditorialFactsAdapter`: owner-reviewed news and original facts for Daily/Weekend.
- `RightsAndProvenanceGate`: policy/contract/asset rights, event evidence, copied-text check, source freshness.
- `ShowDirector`: MatchStoryDirector, DailyDirector, WeekendDirector, TeamOfWeekDirector output common `EpisodePlan`.
- `NarrativeEngine`: deterministic evidence-driven skeleton + optional Mkety AI enhancement; review-required for unsupported interpretation; fallback to structured templates on AI failure.
- `ScenePlanner`: scene timing, captions, stats, 3D camera shots and visual truth labels.
- `RenderAdapter`: open-source default Blender + Three.js (web preview) + FFmpeg motion graphics/compositing; optional Remotion adapter only if license eligible; optional cloud renderer adapter later.
- `VoiceAdapter`: human-recorded WAV or explicitly approved local TTS (e.g. OpenVoice; voice models and speaker consent/license reviewed); never impersonate an identifiable commentator.
- `MediaStore`: private R2 originals, drafts, snapshots, final MP4, poster, caption files and manifest via V2 Media adapter; signed review links, retention and deletion.
- `EpisodeOrchestrator`: durable queue, job leases, immutable input digest, idempotency, retries and status. Avoid in-process Cloudflare request rendering.
- `PublishingOutbox`: approval-only publication with exactly-once *intent* and external-platform idempotency/reconciliation (external APIs do not guarantee true exactly-once).
- `StudioAdmin`: role-restricted episode list, script editor, preview player, scene editor, audio controls, costs, errors, approval, schedule, publish, revoke; audit log and step-up for production publishing.

**Isolation:** a namespaced Factsport TV module (proposed `app/admin/tv`, `app/lib/tv`, `workers/factsport-tv-*` only after source review), own schema/tables/queues/least-privilege roles under Factsport V2 DB, shared authentication, editorial/media IDs and monitoring. CPU/GPU render jobs run on a separately provisioned worker/service outside edge request timeouts; Cloudflare handles orchestration + media delivery, not GPU rendering. Local rendering or a self-hosted renderer is preferred for the free path.

## 6. Free-first technology choices and caveats
| Component | Proposed default | License/cost guard |
| --- | --- | --- |
| 3D cinematic scenes | Blender | GPL software, commercially usable exported artwork; self-hosted compute not free |
| Real-time 3D previews | Three.js | MIT; confirm 3D models/textures/club artwork separately |
| 2D charts/text/motion/encoding | SVG/Canvas + FFmpeg | FFmpeg LGPL/GPL variant compliance; avoid undisclosed binary license issues |
| Editing/compositing alternative | Remotion (optional) | Free only for eligible individuals/teams (up to 3 people as of research), commercial automated organizations otherwise may owe license; don't lock architecture to it |
| AI voice | OpenVoice or manually recorded commentary | OpenVoice MIT code; model/checkpoint terms, rights and cloning consent independently verified |
| Subtitles/QA | whisper.cpp (optional) | MIT code; licensed models and local compute |
| Original prose | existing Mkety AI adapter or manually authored templates | actual AI provider inference may cost money, verify hallucinations and rights |
| Storage/orchestration | existing V2 PostgreSQL/Cloudflare R2/Workers + controlled renderer | Cloudflare/compute/storage/bandwidth not free at unlimited scale |
| Optional SaaS | Shotstack/Creatomate only by explicit owner selection | paid/free trial is not a core dependency |
These tool terms must be rechecked at implementation. References: https://www.blender.org/about/license/ ; https://github.com/mrdoob/three.js/blob/master/LICENSE ; https://ffmpeg.org/legal.html ; https://www.remotion.dev/docs/license/pricing ; https://github.com/myshell-ai/OpenVoice ; https://github.com/ggml-org/whisper.cpp .

## 7. Asset, licensing and commentary boundaries — release blockers
- Preferred Factsport database values and ESPN-derived structured match facts; ESPN commentary text is **not a free-to-republish creative asset**. Independently generated prose does not cure upstream data/API contractual restrictions.
- Legal/provider permission review required for commercially redistributing ESPN-derived statistics, commentary-derived event datasets, team/player branding and automated published videos. Respect ESPN service terms and any local data protection/publication laws. A private technical ability to fetch an endpoint is not a content license.
- Build an asset provenance table including uploader, source URL, rights basis, permitted uses, territory/term, attribution requirement, revocation date and review state.
- Do not use sports footage or broadcaster/commentator voices without licensing. Original illustrations, licensed models, original voice or consenting voice actors preferred.
- YouTube policy gates for altered/synthetic realistic scenes, originality/repetitive content, channel OAuth, audience disclosure, upload rights; no automatic mass posting.
- Add on-screen text for illustrative action and source/reference in description where needed.

## 8. Media Studio workflow and statuses
`proposed -> input_ready -> facts_validated -> script_draft -> editorial_review -> storyboard_ready -> render_queued -> rendering -> rendered -> qa_review -> approved -> publish_queued -> published`; independent `failed`, `blocked_rights`, `needs_data`, `revision_requested`, `cancelled`, `retracted`.
- Three modes: automatic draft; assisted manual edit; entirely manual story-building within same templates.
- First launch ALWAYS manual approval, with owner-admin controlled later automation only for narrow fully verified formats.
- Story, scenes, script, narration, music, titles, tags, thumbnails, captions, 16:9 video and 9:16 clip export are individually editable.
- Store provider timestamps, generated text versions, AI prompt/model version (no secrets), approvals, source references, render logs, QC and linked YouTube IDs; admin RBAC and signed previews.
- Upload initially as private/unlisted if platform permits; require YouTube API authorization/audit and explicit publishing permission.

## 9. Concurrent implementation and production activation
**Required:** implement an isolated subsystem in `refactor/factsport-v2` alongside Media and Predict, using synthetic/licensed fixture data. This advances video development without altering the live sports cutover. The first video/social posts should start as soon as required rights, channel authorization and human review are in place.
1. Documentation, design, license checks, no new production secrets.
2. Offline golden fixture + four-minute 3D-first MP4 prototype (original assets), 16:9 and short 9:16, human narration fallback; verify audio/timing, fact traceability, watermarks and failures.
3. Implement read-only snapshot integration against isolated **staging** only after migration availability, with no direct Supabase/ESPN scraping from renderer.
4. Add Factsport TV isolated schema, admin UI, durable jobs and R2 media under separate reviewed migrations/least-privilege roles. Do not apply migrations to prod.
5. Complete staging tests, human editorial review, rights/licensing check, performance/cost benchmark, creator/platform API permissions.
6. Complete the staging TV engine and human-reviewed social publishing workflow with Media and Predict. Production schedules and automated publication still require a separate go/no-go after source/asset rights, platform permissions and operational controls pass.
Factsport TV is required for final V2 completion/cutover, even though core Media and Predict can be independently built and tested.

## 10. Acceptance tests
- Render deterministic 4-minute fixture with opening, both lineups if supplied, ordered halves, HT, substitutions, cards, 3D *illustrative* goals, stats, tactical review and final outro.
- Tests for missing lineups/stats, no goals, multiple goals, own goals, VAR reversals, penalties, extra time, stopped/abandoned matches, postponed, duplicate/late events, changing FT, ESPN unavailable, bad IDs, empty commentary.
- Every spoken fact must be backed by a source datum or explicit human editorial assertion; no fabricated events and zero copied third-party commentary sentences.
- All 3D inferred play labeled illustrative; no false-realistic replay claims. Human overrides preserved and auditable.
- Retry after rendering failure does not publish duplicates; reconcilable uploads.
- Admin view is RBAC restricted; no production keys in browser or repo, private R2 signed assets, access audit, retention/deletion tests.
- Quality check video black frames, clipped titles, audio loudness, subtitle sync, frame rate, video render stability, 1080p landscape and 9:16 derivative.
- Benchmark CPU/GPU render time, total cost per episode, failures, peak queue, storage and quota use. **No exact cost promise until benchmarked.**
- Source data and YouTube rights verified in writing and all release gates signed off.

## 11. Open questions / decision register
- ESPN commercial data reuse and redistribution permission is OPEN. No production publishing from its data until resolved.
- Default narrator voice and licensed models OPEN.
- Actual logo, stadium, kit, music and player model rights OPEN.
- Free-first renderer choice: Blender + Three.js + FFmpeg PROPOSED; if Remotion is used, eligibility/legal review required.
- Video formats/version 1: Match Story first, other directors designed but not production implemented.
- Separate V2 production cutover and TV launch approvals REQUIRED.
- This spec deliberately does not authorize code deployments, production schedules, data changes, platform uploads or Cloudflare/Azure configuration changes.

## 12. Links to current V2 program
- `docs/audit/ROADMAP.md`
- `docs/audit/PRODUCTION-EXECUTION-PLAN.md`
- `docs/audit/V2-PARITY-REBRAND-ADSENSE-ACCEPTANCE.md`
- `docs/audit/SPORTS-001-fixtures-standings-schedules.md`
- `docs/audit/FULL-SYSTEM-2026-11-06.md`
- GitHub tracking: https://github.com/MketyDigital/Factsport/issues/288

**Implementation checkpoint (2026-11-23):** an offline deterministic Match Story planner, server-only YouTube resumable-upload primitives, consent/rights/approval-gated TikTok inbox-draft primitive, and protected read-only `/admin/tv` storyboard prototype now exist. The preview uses abstract CSS 2.5D and data-safe 2D scenes; it is not a renderer or publish control. YouTube uploads start private and carry the synthetic-media disclosure field; TikTok creators finish posts in TikTok. The production TV renderer, editor workflow, durable episode/outbox persistence, platform OAuth setup, verified asset source, Meta/other-social dispatch, rights acceptance and staging end-to-end journey are not implemented. No production credentials, uploads, routes, workers or schedules were created.

## What Factsport TV is for, and how an editor uses it

Factsport TV is the internal production desk for making original football videos for Factsport's YouTube and social accounts. It is not a live match broadcaster, streaming channel, or automatic public-posting bot. The planned shows are Match Story, Factsport Daily, Weekend Football Review and Monday Team of the Week / Table Changes. Match Story is the first production target.

The intended editor journey is: choose a final eligible match or reviewed editorial; generate an evidence-backed narration and storyboard draft; correct the wording and scenes; attach only licensed assets; render landscape and vertical versions with audio and captions; review factual accuracy, rights, disclosures and video quality; approve the package; then send it privately to the connected platform or to a creator inbox. A person approves the first publication and controls public release. Automatic steps prepare repeatable drafts; they do not waive human approval, platform authorization or licensing checks.

Current source-tree capabilities are an authenticated private studio, match/episode draft, evidence-linked script editor and review, saved storyboard with 2D/2.5D scene previews, private pending-rights 3D model intake, deterministic short render proofs, and server-side upload adapters. These pieces do not yet combine into a complete episode-making workflow. The full 3–5 minute renderer, integrated voice/music/captions, durable render queue, operational editor acceptance, and end-to-end authorized social publishing remain incomplete. No social post is published automatically today.

The owner reports their stadium GLB is 300–400 MB and commercially usable without credit. The planned private intake limit is 512 MiB with resumable 16 MiB parts, so that file fits without requiring one huge request. The owner-provided license statement is recorded as a claim until a separate rights reviewer checks the actual asset/source/license evidence. “No attribution required” can be recorded and honored if that evidence supports it; it does not mean the model is already approved or currently used in renders.

The 3D stadium is an environment for cinematic openings, transitions and stylized scenes. It does not create actual match footage. Player and ball motion inferred from event data must be clearly illustrative; real player likenesses, club marks, match footage, narration and music each need their own rights decision. 2D graphics remain the preferred clear option for exact statistics, lineups and timelines.


## 2026-11-24 implementation follow-up — editorial planning

The `/admin/tv` draft workflow now includes persisted episodes, evidence-linked narration, independent script approval and a stored text-only storyboard built from one 2D fact-card scene per approved narration block. This is a planning layer, not video production: it generates no media assets, audio, render jobs or uploads. Data and asset rights remain uncleared, so the episode remains blocked from rendering and publishing. Exact source head `aa0a5e9` passed isolated verification [45324494210](https://github.com/MketyDigital/Factsport/actions/runs/45324494210), native build [45324494239](https://github.com/MketyDigital/Factsport/actions/runs/45324494239), and protected staging preflight [45324494220](https://github.com/MketyDigital/Factsport/actions/runs/45324494220). The earlier 2026-11-23 checkpoint above describes the state at that time.


## 2026-11-24 implementation follow-up — private scene preview

The Studio now previews each persisted storyboard scene in an animated, responsive broadcast-style 2D/2.5D panel, with cited facts, timing and accessible scene controls. Reduced-motion preferences are honored. Visuals remain abstract and explicitly illustrative; this is not generated footage or a publishable episode. Exact head `454c932` passed isolated verification [45342942972](https://github.com/MketyDigital/Factsport/actions/runs/45342942972), native Cloudflare build [45342942964](https://github.com/MketyDigital/Factsport/actions/runs/45342942964), and staging [45342943031](https://github.com/MketyDigital/Factsport/actions/runs/45342943031).


## 2026-11-24 implementation follow-up — fact provenance display

Source and observation timestamps now appear directly with each cited fact in the interactive storyboard preview, improving claim traceability during human review. Exact source head `3f0d6c6` passed isolated verification [45343476559](https://github.com/MketyDigital/Factsport/actions/runs/45343476559), native build [45343476547](https://github.com/MketyDigital/Factsport/actions/runs/45343476547), and staging [45343476525](https://github.com/MketyDigital/Factsport/actions/runs/45343476525). This remains a private planning preview and does not authorize media publication.


## 2026-11-24 implementation follow-up — private 3D asset library

The Studio now stores reusable GLB model assets in private R2 and a V2 TV asset library, links them to episodes, validates glTF 2.0 and blocks external file references. Owner-provided source/license details are recorded as unverified; the model remains rights-pending and unavailable for rendering or publishing. This build has a 32 MiB upload cap. For generic, non-identifiable player geometry/animation, the official Quaternius pages for [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) mark those packages CC0 and suitable for commercial projects; keep the per-pack license file with each imported asset. Exact code head `cb2d13a` passed isolated verification [45354250796](https://github.com/MketyDigital/Factsport/actions/runs/45354250796), native build [45354250921](https://github.com/MketyDigital/Factsport/actions/runs/45354250921), and staging [45354251013](https://github.com/MketyDigital/Factsport/actions/runs/45354251013).
