# M59 — Correct M58 HLS detector regression and make test executable

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: targeted source fix and strengthened regression test; repository CI/build and browser E2E remain unverified.

## Owner-approved architecture

The owner explicitly rejected activating paid Cloudflare Stream hosted VOD. The existing Stream.io live studio, approved YouTube/external media URLs, and R2 still-image workflows remain the V2 Media architecture. M53's compile-time Stream restriction and M58's removal of paid-VOD admin/editor surfaces stay in force.

## Discovered defect

A source audit of M58's `app/components/FactSportPlayer.tsx` uncovered that the new `isHls` detector contained an accidental **double backslash** in the regex literal:

```ts
// Incorrect: matches a literal backslash before any character followed by m3u8
const isHls = /\\.m3u8$/i.test(rawMediaPath);
```

The existing generic raw-media expression did classify signed `.m3u8` URLs, but the HLS-specific flag remained false, so the new `hls.js` playback branch would never execute in ordinary usage. This invalidates any prior implication that the M58 implementation had achieved working non-native-HLS playback.

## Correction

- Changed the literal to `/\.m3u8$/i` (single regex escape for a literal period), preserving path-based detection and original signed query parameters.
- Strengthened `tests/media-legacy-source-security.test.cjs`: it now parses the detector's **real source regex**, constructs `RegExp` and executes real matching assertions against ordinary `.m3u8`, a signed URL pathname, uppercase `.M3U8`, and non-HLS `.mp4`. This specifically catches the escaped-regex error that the earlier keyword-only assertion missed.
- Retained native Safari HLS and the already-installed `hls.js` fallback; no paid provider changes.

Commits: `581092436f312411e92ddfc575bd4bdda3bb9880`, `cd4a0e355681a2a3ad31cc9dc345265f56178519`.

## Verification boundary

The GitHub connector confirmed the corrected regex and test assertions exist on V2. The repository's Node suite, TypeScript, native Vinext build, protected Cloudflare staging and browser/provider playback have **not** been run or confirmed passing in this session. Source inspection is not executable regression-suite validation.

## Prioritized release checks

1. Execute the whole Node test suite, especially the newly executable HLS-source regex test, then typecheck and native Vinext build.
2. Browser-test valid signed `.m3u8` HLS streams on desktop Chrome/Firefox (Hls.js) and Safari/iOS (native HLS); verify playback start, pause, mute, CORS, token expiry, error recovery, switching streams and cleanup.
3. Review all approved historical external embed hosts, newsroom source attribution, the server playback gate and video authorization before adding a restrictive external-host allowlist.
4. Keep Cloudflare Stream paid VOD disabled and outside the release gate; complete authorized external media/CMS and Stream.io integration instead.
5. Confirm independent Media, live-worker/social and Prediction parity/cutover checks before any production switch.

No production services, DNS, billing, Cloudflare Stream credentials, Stream.io rooms, database migrations or advertising settings were changed.
