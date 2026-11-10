# M52 — Cloudflare Stream TUS provider-contract hardening

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: targeted source fix committed; isolated CI and real provider/browser staging verification still pending.

## Evidence

- `lib/media/cloudflare-stream.ts`: TUS creation path sends provider `Upload-Metadata`, including `allowedorigins`.
- `tests/media-video.test.cjs`: existing Stream integration contract tests.
- Cloudflare official Stream TUS API documentation describes the `allowedorigins` TUS metadata value as a comma-separated domain list, base64-encoded (example: `example.com,test.com`), rather than a JSON array: https://developers.cloudflare.com/api/resources/stream/methods/create/
- Cloudflare official direct-creator upload documentation requires backend-side authenticated TUS provisioning and browser-side direct uploads: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/

## Change

1. Changed TUS `allowedorigins` metadata encoding from `JSON.stringify(config.allowedOrigins)` to `config.allowedOrigins.join(',')`, still passing through the existing UTF-8 base64 helper.
2. Added a static contract assertion that prevents reintroducing JSON-array encoding.
3. Preserved the existing signed-playback requirement, allowed-origin validation, scoped editor authentication, one-hour expiry, limited sizes, TUS resume, provider ID validation, private DB metadata and rights review gates.

## Verification status

- Source change commit: `a432eb8f9f7741b88d46e5a4180835e150cdd572`.
- Regression assertion commit: `33e2de3a6733b85dab8486791f21c06357e88791`.
- **Not yet runtime verified:** no Cloudflare Stream token is provisioned in this session; no actual TUS POST/HEAD/PATCH/CORS operation was performed, and CI result for these new commits is not claimed.
- Need a current-head isolated test, native build, protected staging check, then authenticated provider-contract and interrupted-upload browser tests.

## Risks and acceptance

- Confirm exact allowed-origins provider behavior in isolated staging, including whether returned Stream video metadata contains the expected approved domains.
- Confirm origin allowlist is about playback and does not replace the separate cross-origin TUS upload CORS test.
- Confirm `stream-media-id`, upload Location, browser header visibility, processing, upload-size validation, rights review, withdrawal and signed playback before enabling `FACTSPORT_STREAM_VIDEO_READY`.
- No migration, Azure resource, Cloudflare token/setting, production workflow, ad flag or DNS was changed.

## Rollback

Revert the targeted source/test commits on V2 if isolated provider-contract testing contradicts the documented encoding. Do not enable the provider feature as a workaround.

## Newly observed repository integration discrepancy

The GitHub combined-status endpoint for M52 HEAD `93a686692bfeb952c6e25cfee76fd2adcdfe1dd8` returned a `Vercel` context in `pending` state, despite the project's Cloudflare-only target architecture and prior source cleanup. This does **not** prove any Vercel deployment happened. It is evidence that a legacy Vercel GitHub integration/status reporter may still be connected or a status context is being posted.

Owner/maintainer should inspect repository GitHub Apps/webhooks/check-required contexts and any Vercel project Git connection. Remove or disable obsolete integration only after verifying it is not needed for a live protected branch/release gate. Check Cloudflare CI independently; the combined-status result did not establish any green checks for this new HEAD.
