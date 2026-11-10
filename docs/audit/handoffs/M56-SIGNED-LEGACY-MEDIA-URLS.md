# M56 — Signed legacy media URLs and external embed privacy

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source implementation and source-level regression checks; full CI and browser verification not yet completed.

## Architecture and authority

- M53 owner constraint remains in force: do not introduce/activate paid Cloudflare Stream VOD.
- Preserve legacy Stream.io live studio, external YouTube, direct video/audio and HLS playback, plus approved external embeds.
- Keep the public match playback eligibility gate in `app/api/match/[id]/playback/route.ts` authoritative; this change does not alter its access or unlock time.

## Problem identified

`app/components/FactSportPlayer.tsx` previously identified raw media using an extension regex ending at the **end of the complete URL**. For example, `https://cdn.example.org/live.m3u8?token=...` failed the test and fell into generic iframe rendering rather than the intended native media/player path. The URL itself must remain unchanged for signed-provider authorization.

## Changes

1. Parse the media URL and classify the final extension from `url.pathname`, leaving query parameters and fragments untouched in the actual `src`.
2. Preserve the `streamio` sentinel and existing MP4/WebM/OGG/MP3/M3U8/WAV formats; malformed/non-HTTP(S) strings do not get classified as raw media.
3. Add `referrerPolicy="no-referrer"`, `loading="lazy"` and a descriptive title to the generic third-party media iframe. Its legacy sandbox permissions are retained for compatibility until historical provider requirements are inventoried.
4. Extend `tests/media-legacy-source-security.test.cjs` with source checks for the pathname classifier, external embed referrer privacy and accessibility title.

Code commits: `ff8168474cd910fab3b618a0a6fcee9813f3f769`, `860ae4893786979eef7b1965de56eb4fa9e52220`.

## Verification and limitations

- Fetched the committed player/test source and verified the new pathname classifier, iframe privacy attributes, YouTube hostname classification and Stream.io sentinel are present.
- **Not claimed:** actual Node test execution, TypeScript check, Vinext build, browser streaming test, production integration or Cloudflare staging rollout.
- Browser behavior for native M3U8 varies by platform; a separate HLS player capability review is required. This change only restores legacy source **classification**, not cross-browser HLS decoding.
- Existing generic iframe sandbox combines `allow-scripts` and `allow-same-origin`. Real provider inventory and origin-isolation testing are needed before tightening it without breaking approved integrations.
- Do not echo signed URLs into logs, metadata, screenshots, reports or public error messages.

## Next acceptance gates

1. Run current-head regression tests, TypeScript/native Vinext build, and protected Cloudflare staging checks.
2. Test real approved MP4/WebM/MP3/WAV/M3U8 URLs with and without signed query strings, including expiry, CDN redirects and playback controls.
3. Inventory authorized generic iframe providers (domain, path, embedding constraints and editorial rights) before enforcing any allowlist or sandbox changes.
4. Continue CMS support for existing external media references and R2 still-image assets; paid Cloudflare Stream remains out of scope and disabled.

## Rollback and side effects

These changes affect V2 source and source tests only; no database migrations, third-party video accounts, Stream.io settings, billing, DNS, secrets, ads or production systems were modified. Revert the targeted commits if a demonstrated legacy provider regression appears during browser staging.
