# M58 — Browser HLS compatibility and paid Stream exclusion

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source-level implementation committed; full automated execution, protected staging and real-provider browser acceptance pending.

## Context and decisions

- Owner decision M53 remains binding: Cloudflare Stream is a separately paid hosted VOD/transcoding service, not the legacy Stream.io live-room service, and has **not** been approved.
- Factsport Media keeps YouTube/authorized external embeds, raw HTTP(S) MP4/WebM/audio, HLS `.m3u8`, Stream.io live radio/studio, and R2 editorial images. Do not add a paid video host without explicit new owner authorization.
- Existing V2 `package.json` already depends on `hls.js@^1.5.8`, but `FactSportPlayer` assigned `.m3u8` directly as a video source, leaving non-native-HLS browsers unsupported.

## Implemented

1. `app/components/FactSportPlayer.tsx`: identifies signed HLS by the previously audited URL **pathname**; Safari/native-HLS browsers use `video.canPlayType('application/vnd.apple.mpegurl')` and keep the original signed URL; other browsers dynamically load the already-installed `hls.js` and attach it to the video element. The HLS instance is destroyed on cleanup. The old native video path remains for non-HLS formats, and `streamio` / authorized external embeds are unchanged.
2. `lib/media/cloudflare-stream.ts`: an explicit **compile-time source constant** `FACTSPORT_PAID_STREAM_OWNER_APPROVED = false` is now required for readiness. Because readiness is false, all Stream provider creation, fetch, delete, signing and upload operations that require the service remain fail-closed even if Stream environment variables or credentials are accidentally set. Reauthorization requires an owner-approved, reviewed source change; flags alone cannot activate it.
3. `app/admin/media/MediaLibraryClient.tsx` and `app/admin/media/page.tsx`: removed the unapproved Cloudflare Stream VOD upload panel and its readiness wiring from the approved R2 editor's media library. R2 image rights/derivatives and usage functions remain visible.
4. `tests/media-legacy-source-security.test.cjs`: source regression assertions protect HLS compatibility, the hard paid-service gate and retention of the approved R2 Media library.

Commits:
- `a5c11f9ee256f6093022356d5496675f3b6ddf81` — HLS fallback
- `56b75d020d81f8e40ae4c79dbf53784c64227bd5` — HLS contract assertions
- `287c14281406e5af997627119c52321b943c8afa` — paid Stream hard gate
- `26d161d88e0cdd0357c30662472ea3289532f7a2` — remove paid VOD editor
- `9f5b3a25a951342597c9bc4da7993fdad0c99067` — simplify Media page
- `7c0f7ca58fcffaeff013a230d1005e1c006c9a6a` — owner constraint regression assertions

## Verification performed

Fetched the committed V2 player, Stream adapter, R2 media editor/page and regression test files through the GitHub connector. Confirmed HLS native/Hls.js branches, original signed media URL usage, the source-level paid-provider rejection, the absence of the paid VOD panel and continued R2 library rendering.

## What this does NOT prove

- The repository was not cloned or its test suite/typecheck/Vinext build run in this session; github.com DNS was unavailable in the container. Source assertions are not runtime test execution.
- Browser playback against a real protected HLS stream was not tested. Check provider CORS, token expiration, MIME types, playback start/stop, HLS error/recovery behavior, Safari/iOS, desktop Chrome/Firefox, and network interruption.
- The dormant VOD library, old migration 0041 and separate paid video routes remain in the repository for audit, but provider calls are guarded at the Stream adapter. A later cleanup should archive unused VOD code without touching legacy approved media.
- The article draft's dormant VOD attachment section may still appear as informational UI in some routes and must be excluded from the approved editorial workflow separately.
- Does not prove absence of charges/resources within any external Cloudflare account. Cloudflare billing and service inventory require read-only account access.

## Next milestones

1. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` on V2 HEAD and protected Cloudflare staging.
2. Audit full legacy external-provider URL inventory and iframe constraints without breaking approved embeds.
3. Build editorial CMS support for approved external video references with revision lineage, licensing/rights, expiry and preview; do not turn on Cloudflare Stream.
4. Continue audit of the separate Stream.io live studio roles/invite lifecycle and remaining Media/social/live worker and Prediction parity/cutover gates.
5. Keep AdSense-sensitive Media and paid Prediction separation; enabling public ads, SEO indexing and production migration requires release approval.

No production change, DNS cutover, paid video provisioning, live Stream.io operation, data migration or AdSense activation occurred.

## Newsroom paid-VOD exclusion follow-up (same milestone)

After the initial M58 document, a deeper audit confirmed `app/admin/news/NewsroomClient.tsx` still mounted the dormant paid Cloudflare Stream VOD attachment and preview components. These controls have now been removed from the approved newsroom UI; the R2 image gallery, editorial source references and historical revision comparisons remain intact. `tests/media-legacy-source-security.test.cjs` now protects that decision.

Additional commits:
- `438abb0e1bb28c22a69216016a65356ed40a2fd4` — remove unapproved VOD editor and video preview surfaces
- `60f6f385d9c24b92822aa81e3137faca9e65eb6d` — remove unused current-video preview state
- `1fbc4a126fc5956256f6ed7c4c901b5598b64179` — strengthen newsroom regression assertions

All changes were made to the V2 source branch only. The migration, legacy published content and existing provider assets were not deleted; these remain subject to separate owner-approved data-retention decisions. Current-head tests/build/staging remain pending, and dormant code is not equivalent to a deployed billable resource.
