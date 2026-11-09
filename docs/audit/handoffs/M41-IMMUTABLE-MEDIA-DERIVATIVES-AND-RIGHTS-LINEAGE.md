# M41 — Immutable Media derivatives and inherited rights lineage

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source implementation committed; isolated regression and native Worker build passed on commit 41ee5cfd1b0dbbdeed739ec952f093755d7274f7; protected staging workflow is being rerun on the latest source; migrations 0038/0039 unapplied; no real R2 derivative has been created in staging.

## Implemented

- Migration 0038 revokes table-wide UPDATE on media_assets from factsport_v2_editorial_writer and grants only rights status/reference, attribution, alt text, usage expiry, rights-review identity/time, is_public and updated_at. Asset identity, object key, content type, byte size, hash, dimensions and uploader cannot be rewritten by the CMS role.
- Migration 0039 adds media_asset_derivatives. Each immutable derivative is a new media_assets row linked to its original source asset, with a fixed variant key, JSON transform specification, creator and timestamp. The lineage table grants the editorial writer SELECT/INSERT only; no UPDATE/DELETE is granted.
- Media Library now offers four responsive presets:
  - hero 16:9 (1600×900)
  - social square (1200×1200)
  - thumbnail 4:3 (800×600)
  - team square (512×512)
- Editors can adjust horizontal and vertical crop focus. The browser decodes the private source preview, uses a high-quality canvas crop/resize and encodes a WebP derivative at quality 88. The original object is never overwritten.
- POST /api/admin/media/derivatives requires Media RBAC and same-origin request, limits output to 8 MB, validates WebP signature and dimensions, enforces preset dimensions and focus bounds, and calculates SHA-256.
- The endpoint verifies source rights are approved and unexpired, then rechecks and locks the source row FOR SHARE inside the insert transaction. The derivative inherits rights status/reference, attribution, expiry and reviewer metadata, but remains private until attached to an approved published revision.
- R2 objects are stored under editorial/derived/ with private cache metadata. If database registration fails, the new object is deleted as compensating cleanup.
- Audit event media_derivative_created records source/derivative IDs, preset, dimensions, crop focus and digest.
- Public general-media, social-media, inline-gallery and article hero/team projections now reject derivatives whenever the original source has lost its approved rights state or has expired.

## Important limitations

- This is a browser-side crop/resize pipeline, not a server-side raster decoder/transcoder. The server validates the resulting WebP container signature and dimensions but does not independently prove that the submitted pixels were generated from the referenced source. The editor is an authenticated Media role; the source and derivative remain private until the separate publication gate.
- Current crop UI uses fixed output presets and horizontal/vertical focus sliders. Arbitrary freeform crop rectangles, focal-point drag handles, AVIF output and automated responsive srcset generation are not included yet.
- The original asset is preserved. Derivative asset rows and lineage are append-only through the application role; no destructive replacement or deletion endpoint exists.
- Rights inheritance is evaluated in public SQL views at read time. Changing the original source to rejected/expired or allowing its usage window to expire immediately removes derivative eligibility from those projections.
- The public R2 route continues to resolve by object key through PostgreSQL public views. Private previews use the authenticated asset-ID route.

## Validation and activation boundary

- Added tests/media-derivatives.test.cjs and extended tests/public-media-migration-guard.test.cjs.
- CI migration inventory now extends through 0039.
- Isolated regression and native Worker build passed on commit 41ee5cfd1b0dbbdeed739ec952f093755d7274f7 (runs 42562605350 and 42562605340). The protected staging run was cancelled by a newer push; the replacement protected staging run is pending on the latest source. The subsequent test-only assertion correction is also undergoing fresh CI.
- Migrations 0038/0039 have not been applied. No editorial Hyperdrive, role or membership provisioning was performed. No R2 derivative was generated in staging or production.

## Remaining Media work

1. Complete exact-commit CI and fix any type/test/build failures.
2. Apply migrations 0038/0039 to isolated staging only after verifying role prerequisites, migration ledger/checksums and the effective grant matrix.
3. Exercise upload → private preview → rights review → derivative creation → revision attachment → independent review → publication → public R2 delivery against real staging PostgreSQL/R2.
4. Test rights revocation/expiry after derivative publication and confirm every public view and social claim immediately suppresses the derivative.
5. Add derivative selection to the newsroom attachment picker, show lineage and preset metadata, and offer a public-layout preview before publication.
6. Add full-page preview parity and scheduled article publication.
7. Design video/clip ingestion separately from the 8 MB image endpoint, including provider/source rights, poster frames, captions/transcripts, duration metadata and safe embeds.

## Safety

No production database, R2 bucket, Cloudflare binding, external image service, DNS, provider credential, public media item or production deployment was changed. No production migration was applied.
