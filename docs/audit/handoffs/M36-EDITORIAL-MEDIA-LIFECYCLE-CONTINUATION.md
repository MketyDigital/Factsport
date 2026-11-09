# M36 — Editorial media lifecycle completion pass

Date: 2026-11-09
Branch: `refactor/factsport-v2`
Status: source changes committed; CI verification is being rerun; no editorial migration, R2 upload or live public-media delivery has been exercised.

## Verified baseline

The existing implementation already includes:
- Role-protected JPEG/PNG/WebP upload to private R2, 8 MB limit, MIME/signature validation, SHA-256 metadata and compensating object cleanup when DB registration fails.
- Private/no-store R2 previews; searchable and paginated Media library; rights state, attribution, expiry and reusable approved assets.
- Revision-scoped hero, team-logo and ordered inline attachments; public media views that filter to approved/published articles and valid rights.
- Publisher-side revalidation of rights and usage expiry, separate author/reviewer/publisher checks, and public Media policy attestation.
- Public article rendering of hero/team media and an ordered, attributed inline gallery.

## Changes in this pass

- Added a draft attachment panel showing the media already attached to the selected revision, with private preview, placement, gallery position and rights state.
- Added `removeRevisionMedia`, which records removal as a revision-scoped `remove_media=true` instruction and an append-only audit event. It does not delete the R2 object or rewrite the live published article.
- New content revisions now inherit media choices from the previous pending revision, including explicit removal instructions. This prevents a normal text edit/save from silently dropping the revision's selected media.
- When a new draft is created from a published article without another pending revision, the draft is seeded from its currently published hero image, team logos and inline gallery. Editors can now replace or remove existing live media through the ordinary review/publish workflow.
- The upload endpoint now extracts intrinsic dimensions from PNG IHDR, JPEG SOF and WebP VP8/VP8L/VP8X headers; it rejects invalid dimensions, dimensions above 16,000 pixels and canvases above 40 megapixels. Width/height are stored in PostgreSQL and R2 metadata.
- Public inline gallery images now use their intrinsic width/height attributes and asynchronous lazy decoding to reduce layout shift.
- Added regression coverage for attachment carry-forward, published-article media seeding, revision removal, newsroom attachment display and dimension validation.

## Important implementation boundaries

- Media removal is a revision change, not physical asset deletion. R2 assets remain retained for audit and reuse; no destructive deletion endpoint was added.
- Upload dimension parsing validates image headers and pixel bounds; it is not a full raster decoder or transcoder. No crop/resize/AVIF/WebP conversion pipeline is claimed.
- Existing public media remains gated by PostgreSQL public views, rights review, publication state and expiry. The admin preview remains authenticated and private.
- No new SQL migration is required for this source pass; it uses the already-defined `editorial_article_revision_media` schema from migrations 0014 and 0027.
- The public article body preview still uses the sanitized Markdown renderer, but exact full-page preview parity with hero/team/gallery placement is not yet implemented.
- No runtime verification has been performed against the editorial Hyperdrive, R2 bucket, applied migration 0027 or a real editor/publisher account.

## Validation and current blockers

- The first typecheck caught an optional inline-position type error in the new removal action; this was corrected by defaulting an omitted inline position to zero.
- A later isolated regression run caught an over-specific source assertion in the new image-dimension test; the assertion was corrected to match SQL-template interpolation. Earlier source changes through the dimension parser passed the native Worker TypeScript/build workflow.
- Latest source commit at handoff: `937222b0ba46e61b14801439f3eb1b98f900f52c`. Awaiting fresh isolated verification and native build results for this exact commit.
- Migrations 0004–0027 remain unapplied to isolated staging; the dedicated editorial Hyperdrive and role memberships remain unprovisioned. R2 upload and publication visibility have not been runtime-tested.

## Remaining Media work

1. Full-page revision preview that renders hero, team marks, inline media, captions and article content using the same layout as the public article route.
2. Crop/resize/thumbnail variants and a tested image transformation pipeline; keep originals immutable and preserve source rights metadata.
3. Rich media lifecycle for video/clip assets, with explicit provider/source rights, poster frames, duration, captions/transcripts and safe embed allowlists. Do not upload large video through the current 8 MB image endpoint.
4. Asset replacement/version lineage, usage/reference discovery across published articles, and safe rights-expiry/revocation workflows. Do not delete objects still referenced by published content or audit history.
5. Apply migrations in order on isolated staging, provision the dedicated editorial writer and Media admin roles/Hyperdrive, then test real upload, preview, attach, replace, remove, review, publish, expiry and public delivery.
6. Complete separate social-provider dispatch and live Studio/Stream staging E2E; these are Media capabilities but are not made operational by the editorial image CMS work.

## Safety

No production database, legacy Supabase rows, Cloudflare production route, DNS, R2 bucket policy, social credentials, Stream configuration, AdSense account or production deployment was changed. No legacy data was imported or deleted.


## Follow-on refinements

- Added direct private image upload to `/admin/media`; the asset remains pending/private until rights review and attachment through an editorial revision.
- Expanded the newsroom preview to reuse the public `NewsArtwork` and `MarkdownRenderer` components and display current revision hero/team marks and ordered inline gallery with captions. It deliberately omits ads and live sidebar modules.
- Added an early Content-Length guard before multipart parsing; the per-file size, MIME/signature and intrinsic dimension/pixel checks remain enforced server-side.
- Latest code now includes these refinements; CI for the newest source commit is pending. The preview is article-surface parity, not a complete page shell with live modules.
