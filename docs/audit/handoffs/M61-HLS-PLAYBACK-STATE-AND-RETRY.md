# M61 — HLS/native playback-state and retry correction

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: focused implementation and regression source assertions; full repo Node/TypeScript/Vinext and protected browser staging pending.

## Owner scope
Factsport Media remains the public/indexed product. Keep approved YouTube, signed external MP4/WebM/MP3/WAV/M3U8, Stream.io Goal Rush rooms and R2 editorial images. The separately billed Cloudflare Stream VOD product is not approved: M53/M58's source-level rejection and hidden admin/newspaper VOD controls remain enforced.

## Audit finding
In `app/components/FactSportPlayer.tsx`, native audio/video `startPlayback` and `togglePlay` previously set the player state to **playing** before the browser's `HTMLMediaElement.play()` Promise resolved, and ignored rejection. This is particularly likely with HLS.js async source attachment, unsupported media, blocked autoplay or expired signed playlist URLs. Controls could claim the stream was playing while it was not.

## Changes
- Introduced a shared `playNativeMedia` path for audio/video media elements. It sets playing/started only after `media.play().then` resolves.
- A rejected play promise resets started/playing and presents a retryable, accessible play-overlay error rather than an unhandled promise rejection.
- `onPlaying`, `onPause` and `onEnded` keep audio and video state synchronized with browser media events.
- Preserved existing YouTube iframe command workflow and explicit `https://www.youtube.com` postMessage target; untouched HLS.js/native HLS source selection and streamio sentinel.
- Added assertions to `tests/media-legacy-source-security.test.cjs` covering failure state, retry overlay and media event parity.

Commits:
- `ffc42609c46cc29a6a0e113d5e5a4695e3da96d1` — handle native play() completion/failure and media events.
- `8fc977f330bc3d355257b7f74396da81e659b7b5` — restore play overlay on rejection.
- `af3f1b30530f0109dc2a8385a48cede54cc9695a` — source regression assertions.

## Verification completed
Fetched the V2 player and test files through the GitHub connector and inspected the complete new play path and corresponding assertions. No source-only inspection is presented as a full test execution.

## Remaining gates
1. Run repository Node tests, TypeScript and native Vinext build on latest V2 head.
2. Run protected Cloudflare staging, and test video/audio with valid, expired, missing and CORS-blocked HLS playlists in Safari and Chromium/Firefox.
3. Confirm actual play() fulfillment and rejection UX, playlist attachment timing, source switching, pause/end cleanup, and mobile user-activation behavior.
4. Inventory approved external embed providers, complete the legacy media CMS reference/rights workflow and Stream.io staging tests.
5. Preserve Media vs Prediction boundaries, live external worker ingestion and social rewriting, SEO/AdSense restrictions and release-only cutover gating.

No live provider account, DNS, billing, database, paid VOD, ad setting or production deployment was changed.
