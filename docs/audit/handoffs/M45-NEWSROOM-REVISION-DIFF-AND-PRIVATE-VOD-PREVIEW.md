# M45 — Newsroom revision comparison, private VOD preview and optional schema safety

Date: 2026-11-09
Branch: refactor/factsport-v2
Source checkpoint: 7be8065d8ad75f6796ca572ef71853daf3eee61a
Status: source implementation, isolated regression, TypeScript and native build passed; protected application staging was still in progress when recorded.

## Implemented

### Revision history and restore integrity

- The admin revision-history endpoint now returns revision-scoped image placements, video attachments and source provenance alongside each immutable snapshot.
- The newsroom comparison view now compares headline, slug, excerpt, category, home/away teams, tags, SEO title/description, canonical URL, author display name, homepage headline and breaking-news flags.
- The comparison view also compares image placements, video clips and source references, while retaining side-by-side Markdown body snapshots.
- The newsroom current-revision query now falls back to the latest published revision when there is no active draft/review revision. This restores published hero/team/inline image attachments to the editor rather than showing an empty media list.
- The existing restore action was re-audited: it creates a new draft revision, copies revision media, videos and sources, and does not replace the live published article when restoring a published article.

### Private video preview

- The newsroom article preview now displays attached video clips in revision order.
- Ready clips use the existing `MediaVideoPreview` component and the admin-only signed preview endpoint. The browser receives only a short-lived signed iframe URL; the raw Cloudflare Stream UID remains server-side.
- Non-ready clips display a processing state rather than a broken player.
- The public article renderer remains separate and uses the public signed-playback endpoint only for published, rights-cleared video assets.

### Optional VOD schema readiness

- The public editorial adapter queries `public_editorial_article_videos` only when `FACTSPORT_MEDIA_VIDEO_SCHEMA_READY=true`.
- The newsroom page and revision-history endpoint load video metadata only when the same readiness flag is enabled; otherwise they return an empty video list without referencing VOD tables.
- This prevents an unapplied optional migration 0041 from taking down the core newsroom or public article read path.
- The flag remains unset until migration 0041 is applied and verified in the owner-approved isolated Azure staging database.

## Verification

- Isolated verification passed on commit `7be8065d8ad75f6796ca572ef71853daf3eee61a`, run [42573678384](https://github.com/MketyDigital/Factsport/actions/runs/42573678384).
- Engine regression suite: 213/213 passed. Isolated ingestion suite: 5/5 passed. TypeScript and migration inventory checks passed.
- Native Vinext build passed on the same commit, run [42573678410](https://github.com/MketyDigital/Factsport/actions/runs/42573678410).
- Protected Cloudflare application staging run [42573678448](https://github.com/MketyDigital/Factsport/actions/runs/42573678448) was building/deploying at handoff time; no staging pass is claimed until it completes.
- The 0001–0042 disposable PostgreSQL migration chain remains green from run [42572684152](https://github.com/MketyDigital/Factsport/actions/runs/42572684152). M45 changes no database schema.

## Remaining acceptance

1. Complete the protected application staging workflow.
2. In owner-approved isolated Azure staging, verify revision history with a published article that has hero/team/inline images, sources and videos; verify the latest draft is compared to older published revisions correctly.
3. Restore a published revision and verify it creates a new draft with all source/media/video attachments while the live public article remains byte-for-byte unchanged.
4. Verify the private video preview returns a short-lived signed iframe URL only to authorized Media editors and never returns the provider UID.
5. Verify public article reads work with VOD schema flag off, then enable the flag only after migration 0041 is applied and video playback/rights checks pass.
6. Finish the full public article preview shell parity and responsive browser E2E. Ad placements must remain placeholders in the admin preview; no ad scripts or impressions should load there.

## Safety

No migration, Azure database, production route, DNS, Cloudflare Stream asset, R2 object, provider credential or public article was changed by M45. No AdSense approval or production VOD readiness is claimed.


## Protected staging follow-up — 2026-11-09

- Protected Cloudflare application staging passed on source commit `7be8065d8ad75f6796ca572ef71853daf3eee61a`, run [42573678448](https://github.com/MketyDigital/Factsport/actions/runs/42573678448).
- Regression suite, TypeScript, native Worker build, protected Worker deployment, deny-by-default probes and the protected PostgreSQL-backed `/matches` checks passed.
- This run does not apply optional VOD migration 0041 to Azure PostgreSQL or enable `FACTSPORT_MEDIA_VIDEO_SCHEMA_READY`. It does not exercise the full Newsroom browser journey, revision restore, or actual Stream private preview.
- No production route, database, R2 object, Stream asset or AdSense configuration changed.


## Responsive SEO/share preview and external-media isolation — 2026-11-09

- Added desktop/mobile viewport controls to the private article preview.
- Added a Google-style search snippet preview with title/description length counts and canonical URL status, plus an Open Graph/social card preview using only local admin media assets or a local Factsport placeholder.
- The preview explicitly loads no ad or analytics scripts.
- Added `disableExternalMedia` to the shared sanitized Markdown renderer. The private preview replaces external Markdown images, protocol-relative images, match widgets and third-party iframes with placeholders. Public rendering remains unchanged by default.
- Approved Stream clips remain available through the short-lived, editor-authorized preview endpoint.
- Isolated verification passed on source commit `67c7d8b13138fa9da4242bb3aabf6b70a106f8cf`, run [42574631125](https://github.com/MketyDigital/Factsport/actions/runs/42574631125): engine regression, TypeScript, anonymous prediction/consent schema contract and migration inventory passed.
- Native build run [42574631124](https://github.com/MketyDigital/Factsport/actions/runs/42574631124) and protected staging run [42574631386](https://github.com/MketyDigital/Factsport/actions/runs/42574631386) were still in progress when this follow-up was written.
