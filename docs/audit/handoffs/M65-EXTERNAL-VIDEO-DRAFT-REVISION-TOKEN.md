# M65 — Revision identity and unsaved-editor safety for atomic external video

Date: 2026-11-11
Branch: `refactor/factsport-v2`
Status: source changes committed and inspected; full Node, TypeScript, database, Vinext and staging verification remain pending.

## Scope and architecture

Factsport Media owns newsroom and external-video embeds; Stream.io continues to own approved live-room workflows; Cloudflare R2 continues storing approved editorial images. The owner explicitly rejected separately billable Cloudflare Stream hosted VOD, whose source-level gate remains disabled. No production cutover or third-party account changes are authorized.

## Problem found after M64

The atomic external video action compared the submitted draft body to the latest draft snapshot. If a second editor saved a **different revision with the exact same body**, this check could not distinguish the stale editor from the current revision. The newsroom's SQL query already selected `current_revision_id` but previously stripped it out of the response to the client.

Further, the atomic action only changed the saved body. If a user had unsaved SEO, headline, slug or other article fields and attached a video, reloading the newsroom on success could discard those unsaved edits.

## Implemented

1. `app/admin/news/page.tsx`: retain `current_revision_id` in the server-projected newsroom rows in both video-schema enabled and disabled paths. This reuses an existing selected identifier; no schema change is needed.
2. `app/admin/news/NewsroomClient.tsx`: add `current_revision_id` to the article representation; derive the selected article's current revision ID and send `expectedRevisionId` alongside `expectedBody` in the atomic attachment request.
3. `app/admin/news/actions.ts`: require a valid UUID revision identity and compare it with the newest **locked** draft's ID before inserting provenance or changing the snapshot. Reject stale revisions even if article body text is identical.
4. `NewsroomClient.tsx`: compare all editor form fields against the corresponding loaded article, including title, slug, excerpt, Markdown body, category, teams, tags, SEO, canonical, author, headline and breaking flags. Disable atomic video attachment while any article edits are unsaved, and tell the editor to save those changes first.
5. `tests/media-legacy-source-security.test.cjs`: assert revision identity projection, client submission, server lock/ID check, dirty-editor guard and preservation of the existing transaction.

Commits:
- `504cac69aab6e2d065602167e632926a24ff4216` — retain page revision ID
- `a34f76c643473484fad309917ab32f1671abe13b` — wire editor revision identity
- `c7806a752a2e0c44d7cb93cb6890268ba59cbba5` — server-side latest revision identity check
- `6051f7e19c306de3f504eadaf5e4c2ce3177e320` — guard unsaved editor fields
- `8c3d3874d1e9fcf653650fbc4bca41c0018bf883` — regression source assertions

## Verification performed

Re-fetched all four committed V2 files via the GitHub connector and verified the actual revision-ID data flow, unsaved-field guard, latest locked revision check, body check, transaction and corresponding source tests.

**Not yet verified:** running the Node suite, native TypeScript/Vinext build, live Postgres read/write locks, concurrent stale-editor race, browser/editor behavior, protected Cloudflare staging or production. No passing CI result is claimed.

## Remaining caveats and acceptance gates

- Revision IDs prevent attaching to a newer draft revision but do not create a per-write version inside one in-place draft. The expected-body check catches competing body edits, while another editor modifying only non-body fields within the same revision is not fully represented by a server-side snapshot hash. Review the full revision mutation model and consider a snapshot/version token for complete protection.
- The unsaved-field guard is a client-side safeguard. Malicious/stale requests are still constrained by the server's auth, revision ID and body check; no client-only check can enforce a comprehensive full-snapshot concurrency contract.
- Existing legacy embed formats, rights claims and historical published media remain under their separate migration/provider audits; source metadata is not legal verification.
- Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext`, and protected Cloudflare staging. Execute two-editor concurrency tests where bodies match but revision IDs differ and where non-body changes are unsaved.
- Continue broader Media / fast live worker / social rewrite / Stream.io room / separate Prediction parity before release. Do not enable paid Cloudflare Stream VOD, DNS switch, production ads, or database cutover without approval.

No migration, live database data, DNS, production deployment, billable Cloudflare Stream resource, Stream.io room, secrets or AdSense settings were changed.
