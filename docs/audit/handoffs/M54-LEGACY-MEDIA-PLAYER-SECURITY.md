# M54 — Legacy-compatible Media playback hardening

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: focused source implementation and static regression assertions; current-head CI/build and browser verification outstanding.

## Owner-approved architecture

- Do not require or provision Cloudflare Stream paid VOD. M53 supersedes M50/M52 provider activation assumptions.
- Preserve external/approved YouTube, MP4, WebM, HLS/M3U8, MP3, WAV, generic approved embed playback and Stream.io live studio.
- Distinguish Stream.io live rooms from Cloudflare Stream hosted VOD, and Cloudflare R2 from either service.

## Inspected current code

- `app/components/FactSportPlayer.tsx`: rendered YouTube detection based on substrings; generic raw and iframe fallback; Stream.io sentinel.
- `app/api/match/[id]/playback/route.ts`: server status/timing gate, saved URL validation and separate PostgreSQL/legacy development path.
- `app/admin/studio/actions.ts`: authorized broadcast settings accepted generic HTTP(S) URLs but did not exclude localhost/private targets.
- `app/admin/studio/StudioClient.tsx`, `app/providers/GlobalMediaProvider.tsx`: legacy-compatible live controls and Stream.io room use.
- Legacy main's `app/components/FactSportPlayer.tsx` and M18 confirm the historical formats and studio behavior.

## Implemented changes

1. Replaced `mediaUrl.includes('youtube.com')` / `mediaUrl.includes('embed/')` detection with actual HTTPS YouTube hostname and fixed 11-character video-ID parsing. Supported canonical watch, embed, shorts, live and youtu.be URLs; use the extracted validated ID when constructing embed URLs.
2. Studio server action rejects local and private-network URL destinations while retaining the `streamio` sentinel and ordinary external HTTP(S) addresses. This prevents an administrator from accidentally storing obvious internal destinations as studio playback sources.
3. Added `tests/media-legacy-source-security.test.cjs` with regression assertions protecting these changes and existing raw/Stream.io paths.

Source commits: `baa6b6a0ea220512aff32dbceda51f566e086e63`, `a1e7c281822038b0b66a81797ae7672a12258c6b`, `71d94d0e0b356ae35ce51eafca6a558453cd93a6`, `047c47a55748f64ea8101744f9325f6c3f08f61e`.

## Explicit limitations

- No current-head CI results or browser E2E results are claimed.
- The existing generic iframe fallback remains permissive. Its provider allowlist, embed CSP/sandbox and historical URL inventory require a separate, **nonbreaking** staged change.
- URL filtering rejects obvious private address literals, but is not a universal SSRF defense or complete protection against DNS rebinding/redirects. Current playback validation does not itself fetch URLs server-side.
- Not all YouTube custom/live URL variants are accepted; unknown URLs remain candidates for the existing generic approved embed path. Validate real provider fixtures before narrowing further.
- A future public media CMS needs explicit rights, editorial provenance, opt-in/embed permissions, and host-specific playback policy; do not silently migrate to a billable video provider.

## Next actions

1. Confirm current-head isolated tests, TypeScript, Vinext build and protected Cloudflare staging.
2. Perform staging playback tests for canonical YouTube formats, external mp4/webm/m3u8, mp3/wav, Stream.io sentinel, and approved third-party embeds; verify 15-minute server gating and finished replay.
3. Audit saved legacy embed URLs/hosts without exposing user data; derive a provider allowlist and exceptions before enforcing one.
4. Continue source-level media CMS enhancements based on approved external media references and R2 imagery, **not Cloudflare Stream**.
5. Keep any Stream-specific paid VOD flags off; do not invoke billable provider tests without owner approval.

No production worker, database, Cloudflare service, Stream.io integration, billing account, DNS or advertising status was changed.
