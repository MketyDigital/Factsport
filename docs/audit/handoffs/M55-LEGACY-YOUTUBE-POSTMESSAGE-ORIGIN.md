# M55 — Legacy YouTube command-origin hardening

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source-level fix and regression assertions; CI/build/browser verification pending.

## Governing owner constraint

M53: preserve Factsport's legacy YouTube/external HLS/raw audio-video/Stream.io architecture. Paid Cloudflare Stream VOD is not an authorized release dependency, and no new paid service may be enabled without explicit owner approval.

## Evidence and defect

`app/components/FactSportPlayer.tsx` embeds the YouTube IFrame API via `https://www.youtube.com/embed/${youtubeVideoId}`. Its three control commands used `iframeRef.current.contentWindow?.postMessage(..., '*')`, broadcasting commands to any origin that might occupy the iframe window. M54 had already added strict YouTube hostname and video-ID detection, making origin pinning the natural next defense.

## Source changes

- Replaced the three YouTube command `postMessage` wildcard target origins with exact `https://www.youtube.com`.
- Updated `tests/media-legacy-source-security.test.cjs` to assert exact target origin, no wildcard command and retention of the Stream.io sentinel and raw-media paths.
- Corrected an escaping error in the first new test assertion, before claiming validation.

Commits: `1a8f6283f7e85f3787f498c166e1c611527d2cd1`, `5aa5e63cf3c256f5adbeae96151ba9fe54dbeb61`, `70acf477d11a2c385569fa65240d397f44a18b5a`.

## Verification

Source-read assertions on the V2 branch confirm exactly three YouTube command calls, explicit YouTube target origin on play, no remaining wildcard target for these calls, and the raw-media and Stream.io paths still present. This is **not** a Node test execution, TypeScript build, Vinext build, staging deployment or browser integration test.

The GitHub combined-status check on the earlier test commit reported only a pending legacy Vercel context. It cannot be considered Cloudflare CI success or evidence of a Vercel deployment.

## Outstanding work

1. Run the repository's actual Node tests, typecheck, native Vinext build and protected Cloudflare staging on the current source head.
2. Browser-check YouTube watch/short/embed/live/youtu.be, play, pause, mute, embed and audio UX, including YouTube iframe origin/permissions and mobile device behavior.
3. Inspect actual legacy embed host inventory and rights before enforcing an iframe provider allowlist; preserve unknown approved third-party sources until audited.
4. Move media CMS functionality toward approved external media references and R2 imagery. Do not provision or exercise billable Cloudflare Stream.
5. Reconcile client player and server playback URL policy using provider-specific capability classification, rather than substring guesses or silent content loss.

## Rollback and scope

Only V2 source and tests changed. Revert the targeted player and regression commits if browser verification shows an approved playback regression. No live database, DNS, credentials, Stream.io, Cloudflare billing, ads or production release was changed.
