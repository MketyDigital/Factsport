# M60 — Signed HLS audio and video parity

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: targeted code and regression assertions committed; full Node/typecheck/browser/staging validation pending.

## Audit finding

The M58 HLS implementation (corrected in M59) only ran the HLS effect when `mode !== 'audio'` and only when the attached media ref was an `HTMLVideoElement`. For media URLs ending `.m3u8` with an audio-mode playback surface, React rendered `<audio src={mediaUrl}>` directly instead. Browsers without native audio HLS support could not use the already-installed hls.js fallback. This is especially material for legacy Factsport radio/live audio presentation and signed external HLS URLs.

## Implementation

1. `app/components/FactSportPlayer.tsx`: the HLS effect now accepts the currently mounted `HTMLAudioElement` **or** `HTMLVideoElement` via the shared `mediaRef`, with the same URL safety check, match lock gate, native `canPlayType('application/vnd.apple.mpegurl')` path, dynamic hls.js fallback, signed URL retention and cleanup.
2. Both audio and video elements now omit direct `src` when the stream is classified as HLS; the effect supplies it natively or through hls.js rather than allowing a browser's unsupported direct-source path to race the adapter.
3. The hls.js adapter explicitly attaches the element before loading the original stream URL.
4. `tests/media-legacy-source-security.test.cjs` now protects audio/video source handling, shared media-ref attachment and the absence of an audio-mode HLS bypass.

Commits:
- `00728e2ebd13270d9115d03da7656b3e0b010d8d` — audio + video HLS support
- `388462828f2ea3e66ea5d7d16f4921ae8162cd0c` — focused regression assertions

## Verification performed

Read the committed V2 player and test source through the GitHub connector. Evaluated the **actual regex expression extracted from player source** in a JavaScript isolate: ordinary and uppercase `.m3u8` paths matched; `.mp4` did not. Verified both audio and video JSX `src` branches defer HLS source attachment and the adapter uses the shared media element.

This **does not** constitute the repository Node test suite, browser HLS streaming, TypeScript compilation, Cloudflare native Vinext build, production checks or protected staging E2E.

## Approved architecture/cost constraint

This change uses `hls.js` already present in the V2 dependency manifest, native browser playback and preexisting external source URLs. It does **not** introduce new video hosting, Cloudflare Stream VOD, transcoding, infrastructure or paid services. M53's explicit paid Cloudflare Stream source gate remains in force. The original Stream.io live room integration remains separate.

## Next acceptance

1. Run Node regression suite, TypeScript and Vinext checks on current branch head.
2. Browser-test real authorized HLS audio-only and video playlists on Safari/iOS and Chrome/Firefox, with and without expiring signed query parameters; verify CORS, lifecycle and playback controls.
3. Verify fail-closed behavior on unsupported HLS browsers, network errors, URL expiry and player unmount.
4. Continue approved external embeds in Media editorial workflow with provenance/rights tracking; audit historical provider hosts before enforcing iframe allowlists.
5. Preserve the fast external live data worker, CMS/social rewriting, separate Prediction parity and AdSense-safe Media cutover requirements.

No live database, provider key, DNS, billing, AdSense, Stream.io room or production deployment was modified.
