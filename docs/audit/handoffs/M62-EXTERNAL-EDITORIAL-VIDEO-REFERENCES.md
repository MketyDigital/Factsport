# M62 — Approved external video references in Factsport Media newsroom

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: source implementation and parser regression test committed; full CI, typecheck, Cloudflare staging, browser and editorial acceptance still pending.

## Scope and owner decisions

- Factsport.com Media is the main product and newsroom. Free predictions are a feature; the separate Prediction system has separate identity and business logic.
- Preserve approved legacy external YouTube/Vimeo embeds, signed raw media/HLS and Stream.io Goal Rush. Do not activate billed Cloudflare Stream VOD or confuse it with Stream.io or R2 imagery (M53/M58).
- External embeds must remain editorially controlled, attributable and compatible with AdSense-safe public article output. Rights records should not leak to public pages.

## Reviewed existing source

- `app/components/MarkdownRenderer.tsx` already sanitizes HTML and supports only `https://www.youtube.com/embed/...`, `https://www.youtube-nocookie.com/embed/...`, and `https://player.vimeo.com/video/...` iframe hosts/paths; it omits external iframes during private newsroom preview.
- `app/admin/news/actions.ts` provides an authorized `addEditorialSource` action storing append-only source title, publisher, canonical URL, attribution and **private rights reference** scoped to the active draft revision. `saveEditorialDraft` copies revision source records into subsequent draft revisions.
- `app/admin/news/NewsroomClient.tsx` already manages editor draft Markdown, versioning, source references, R2 images and editorial review. M58 removed unapproved paid-VOD controls.

## Implemented

1. Added `approvedExternalVideo` URL normalization to the newsroom client. It only accepts HTTPS YouTube canonical/watch/embed/short/live/short-link formats with a validated 11-character video ID, or Vimeo numeric video URLs. It refuses other hosts, embedded credentials and non-HTTPS schemes.
2. Added an **External editorial video** section with URL, title, public attribution, and a required private licence/permission/editorial-basis reference.
3. The editor action uses existing authorized `addEditorialSource` first, then appends an HTML iframe with a **canonical allowed embed host** and visible attribution to the local draft Markdown. It does not upload/transcode video and does not enable a paid provider. The draft must be **explicitly saved** before editorial submission; it is not silently published.
4. The existing public Markdown sanitizer continues to whitelist and sandbox these iframe destinations; private preview remains placeholder-only.
5. Added a regression test that extracts the actual newsroom URL parser and executes it in a Node VM, exercising valid YouTube/Vimeo, fake-host phishing, non-HTTPS, credentials and invalid video IDs. Added source-level assertions for provenance and rights action use.

Commits:
- `69a4784d48c8fc6c873821fd57781ebeeaa7d3d2` — newsroom external video source and embed authoring.
- `c5ba6a08cd95fa592d710fc496a1bd598d5c79f5` — executable approved URL parser and provenance checks.

## Important limitations and safeguards

- **The external video authoring flow is not an atomic database transaction**: source provenance is saved first to the active revision; the embed is inserted in unsaved editor state, and the editor must click Save draft. If the editor leaves before saving, the source remains but the unsaved embed is lost. This is safe with respect to publication but not yet a seamless single-step transaction. A future server action should atomically link source and updated draft snapshot, preserving revision lineage and avoiding stale changes.
- Adding a source and rights note does **not** independently verify that a licence exists or that third-party video rights permit embedding or monetization. Editorial review and provider terms still apply. The existing manual Markdown field can contain approved-host embeds without going through this helper; server-side source/rights association for **all** embedded video URLs remains a release gate.
- Existing provider URL inventory, published articles and historical embed formats have not yet been audited against the constrained authoring helper. Do not block legacy providers without verifying them.
- No browser or third-party provider test, complete Node suite, TypeScript build, Vinext build, staging release or AdSense certification is claimed.
- The paid Cloudflare Stream hard-disabled adapter/UI from M58 remains unchanged. No production provider services were provisioned or billed.

## Next priorities

1. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` on current V2 head and protected Cloudflare staging.
2. Add server-side editorial review validation associating each embedded external-video URL with an approved/current revision source and adequate rights metadata; preserve legitimate historical content and explicit editorial exceptions.
3. Replace the two-step source+unsaved-body authoring path with an atomic revision-scoped server action and a concurrency check.
4. Audit real legacy provider references, browser iframe policies and AdSense-sensitive third-party video player behavior.
5. Continue Stream.io, external fast live worker, rewritten social distribution and separately scoped Prediction parity/cutover work.

No production database, live worker, Stream.io room, DNS, billing account, secrets or ads settings were changed.
