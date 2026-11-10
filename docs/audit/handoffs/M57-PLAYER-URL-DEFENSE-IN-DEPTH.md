# M57 — Player URL defense-in-depth for legacy external media

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source implementation committed; automated tests/build/browser acceptance unverified.

## Owner constraints and platform ownership

- M53 remains authoritative: paid Cloudflare Stream hosted VOD is not approved. No new provider provisioning/billing or paid Stream dependency is authorized.
- Media is the primary factsport.com system. The match player, public media page and Stream.io Goal Rush/rooms belong to Media, not the separate Prediction application.
- Preserve legacy playable external streams (authorized YouTube, HTTP(S) embeds, signed MP4/WebM/OGG/MP3/M3U8/WAV, and `streamio` live rooms).

## Finding

M54–M56 hardened YouTube origin checks, command posting and signed raw-source classification. Nevertheless, `FactSportPlayer` can receive a URL from several Media component callsites, not only from the server's gated `GET /api/match/[id]/playback`. The generic fallback previously attempted to iframe whatever remained. Client-side defense is warranted, but must not silently remove approved HTTP(S) provider URLs.

## Implemented

- Added an `isSafeMediaUrl` check inside `app/components/FactSportPlayer.tsx` before rendering media or globally registering it.
- Retained the special `streamio` sentinel, absolute HTTP(S) external sources, and safe site-relative media paths.
- Rejected non-web schemes (including `javascript:`, `data:`, `file:`), protocol-relative URLs, credentials, path traversal in site-relative paths, backslashes, obvious local/loopback and private-network destinations.
- Unsafe inputs display the existing no-media preview instead of emitting a raw video/audio URL or generic iframe.
- Extended `tests/media-legacy-source-security.test.cjs` source assertions for the guard, fail-closed preview, registration guard, backslash and local/private-network protections.
- Corrected an initially over-escaped backslash check to `String.fromCharCode(92)`, so **a single backslash** is rejected.
- No provider host allowlist was enforced; that requires a data-backed audit of existing approved embeds first.

Commits: `0ab85ff689e8f65b52160860318667e5ceefce42`, `19e82834424368a84733789419693cf467b50bfe`, `264ae3deb957621913a0accdef79f7ce2e6573c7`, `a42c456f49dd79257fbd8cea52cb51105609ace7`, `dcd8d417322e94d730c947a4f550d79eb109755f`.

## Verification

- Inspected the latest committed player/test source through the GitHub connector and confirmed the guard, fallback, legacy Stream.io marker, private address protection and test assertions appear in the correct files.
- The GitHub commit-workflow lookup for M56 returned no pull-request-triggered runs. This API only reports PR-triggered runs, so absence is **not** a claim that all workflows were skipped or failed.
- The container could not reach github.com (DNS resolution failed), preventing a clone and real Node/TypeScript/Vinext execution in this session. Existing source assertions have **not** been executed as part of the repository test suite.
- No current-head passing CI, real-browser playback, or Cloudflare protected-staging result is claimed.

## Remaining Media release gates

1. Run Node regression suite, typecheck, native Vinext build and protected Cloudflare staging from current V2 head.
2. Verify approved YouTube, signed MP4/WebM/HLS, audio, local media paths, external embeds and Stream.io on browsers/devices; include malicious URL negatives.
3. Audit actual legacy stored provider URLs and embed requirements before tightening generic iframe sandbox/provider allowlists. The existing sandbox remains unchanged.
4. Check that browser HLS handling works on non-native-HLS platforms; pathname classification alone is not playback support.
5. Continue the editorial CMS around approved external references, rights and R2 imagery without enabling paid Cloudflare Stream.

No production deployment, live database, external media provider, billable resource, DNS, secrets or advertising configuration was changed.
