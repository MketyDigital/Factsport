# M50 — Resumable Cloudflare Stream VOD uploads

Date: 2026-11-09
Branch: refactor/factsport-v2
Baseline: M49 closeout
Status: source implementation added; current-head CI and protected staging checks pending. No Stream credentials or database resources provisioned.

## Scope

Complete the VOD large-file upload path without routing video bytes through the Factsport Worker. Preserve the existing under-200MB direct-upload path, rights review, signed playback, revision attachments and public playback gates.

## Evidence and decisions

- Existing `MediaVideoLibrary` used Cloudflare Stream direct creator uploads and a browser FormData POST. The UI capped uploads at 200MB and explicitly said larger files require TUS, but there was no TUS endpoint/client.
- Cloudflare Stream's TUS direct-creator flow uses the TUS 1.0.0 creation request, `Upload-Length`, `Upload-Metadata`, `Upload-Creator`, and the returned `Location` plus `stream-media-id`. The browser must use the upload URL for resumable HEAD/PATCH operations; the Stream API token stays server-side.
- Use maintained `tus-js-client@4.3.1`, not a custom TUS protocol implementation. The browser client stores the upload URL for resume and uses 50 MiB chunks with bounded retry delays.
- Keep under-200MB basic uploads for the existing simple path. Use TUS automatically at 200MB and above, or when an editor explicitly chooses resumable mode for a less reliable connection.
- Enforce files smaller than 30GB and duration up to 900 seconds. The Worker provisions the one-time TUS upload resource; file bytes go directly from browser to Cloudflare Stream.
- The upload URL is never stored in PostgreSQL or returned as JSON. It is returned only in the TUS `Location` response header. The opaque Stream media ID comes from the `stream-media-id` response header; do not derive it by parsing Location.
- Migration 0041 now records `upload_protocol` and `upload_expected_size_bytes`. The refresh endpoint compares the provider-reported size with the expected size and fails closed/deletes the provider asset on mismatch.
- TUS URL expiry is one hour. The browser resumes previous sessions within a 55-minute window; expired sessions are discarded and a fresh upload is created. Existing refresh cleanup still only deletes provider records whose state is `pendingupload`, not videos already processing.
- Re-audit found migration 0041 had an orphan duplicated SQL tail after its COMMIT. It has been truncated back to one complete transaction; the disposable PostgreSQL migration workflow verifies the one-BEGIN/one-COMMIT contract.

## Files changed

- `db/migrations/0041_factsport_media_video_assets.sql`
- `lib/media/cloudflare-stream.ts`
- `app/api/admin/media/videos/direct-upload/route.ts`
- `app/api/admin/media/videos/tus-upload/route.ts` (new)
- `app/api/admin/media/videos/route.ts`
- `app/api/admin/media/videos/[id]/refresh/route.ts`
- `app/admin/media/MediaVideoLibrary.tsx`
- `package.json` (`tus-js-client`)
- `tests/media-video.test.cjs`
- `.github/workflows/v2-db-migration-verify.yml`

## Security and integrity controls

- Admin editorial authorization and same-origin checks on TUS resource creation.
- Server validates TUS version, upload length, metadata keys/values, title/description, MIME type and duration. Client-supplied metadata is decoded/validated and rebuilt into the provider metadata; it is not forwarded wholesale.
- The browser never receives Cloudflare API credentials. TUS upload URLs are short-lived one-time capabilities and stay out of DB rows and logs.
- Cloudflare upload URL host/path and Stream media ID are validated. Provider ID storage supports opaque alphanumeric IDs 32–64 chars, subject to real staging confirmation of the provider header contract.
- Stream assets remain private and signed-playback-required; no upload automatically grants rights approval, attaches an article, or enables public playback.
- Expected byte size and protocol are recorded at upload creation. A provider-ready video with missing/mismatched size is not marked ready and its provider asset is deleted best-effort.
- TUS session URLs are persisted by tus-js-client's URL storage for resume; if browser storage is disabled, the UI blocks resumable mode rather than falsely claiming resume support.

## Verification

Pending on current source head after the final client resume and migration/test fixes:
- isolated regression tests, including the new VOD/TUS test;
- TypeScript and native Vinext build;
- protected Cloudflare staging deployment;
- disposable PostgreSQL migration chain with updated 0041 schema/size constraints.

No live Cloudflare Stream upload has been performed. No Entra, Stream token, editorial Hyperdrive, Azure database role, migration or public feature flag was provisioned/activated.

## Required staging acceptance

1. Apply migration 0041 only to owner-approved isolated Azure staging after the disposable chain passes.
2. Provision the dedicated Stream API token/signing key and confirm the exact TUS `stream-media-id` value format returned by Cloudflare; verify DB and signed-token compatibility.
3. Upload a file under 200MB through the basic path; verify expected size, processing, rights review, signed preview and public article playback.
4. Upload a file above 200MB through TUS; interrupt network mid-chunk, reload the page, reselect the same file and verify resume continues from the stored TUS offset.
5. Test retry exhaustion, expired one-hour URL restart, unsupported MIME type, max-size rejection, max-duration rejection, provider 429/quota errors and expected-size mismatch.
6. Confirm no API token, raw upload URL, private Stream UID, or unpublished media leaks to public APIs/logs.
7. Confirm upload completion alone never changes rights status, attaches the video to a revision, or makes playback public.
8. Test rights withdrawal, derivative/cache invalidation, revision restore and public signed playback after successful rights review.

## Rollback

The change is source/migration-only. Keep the new TUS UI path and feature flag disabled until staging acceptance. If TUS fails, editors can continue using the existing under-200MB basic direct upload. Do not drop columns or delete uploaded assets as a rollback shortcut. Migration 0041 has not been applied to staging/production.


## Verification update — source checks passed, staging deploy in progress

- Isolated verification passed on source commit `e3dac371fa40293ae73e0a1c75c1cd78419b6fff` (run `42584448535`): 226 regression tests, TypeScript, migration inventory and Media contract checks passed.
- Native Vinext build passed on the same source commit (run `42584448487`).
- Protected Cloudflare staging run `42584448515` completed dependency installation, regression suite, TypeScript and native Worker build; deployment and deny-by-default checks were still in progress at this update.
- Disposable PostgreSQL migration chain through 0043 passed on commit `55464ea4a8d3000a836d109d1ad4c20397922d50` (run `42584159460`), including the revised migration 0041 transaction and VOD expected-size columns/constraint.
- No actual Stream upload, TUS browser interruption/resume, Stream UID response validation, Azure staging migration or media-provider E2E has been performed.
