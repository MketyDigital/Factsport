# M63 — Server-side editorial external-video source/rights gates

Date: 2026-11-11
Branch: `refactor/factsport-v2`
Status: source code and executable-in-Node regression assertions committed; full test suite, TypeScript, native Vinext build, staging and browser acceptance remain unverified.

## Context

M62 added YouTube/Vimeo editorial source capture and allowed-embed authoring to the Factsport Media newsroom. It stores a private rights reference through the existing revision-scoped `editorial_article_sources` table, then places the external iframe into **unsaved** draft Markdown. The server review/publish actions previously had no corresponding provenance check, so a direct Markdown edit could skip the M62 controls.

Owner decisions: Factsport.com Media is the primary product; Prediction remains separate. Preserve legacy raw/signed video and HLS, the **Stream.io** studio, R2 imagery and approved external embeds. Paid **Cloudflare Stream** hosted VOD remains unapproved/disabled.

## Implemented

1. `app/admin/news/actions.ts`: `externalVideoCanonicalUrls` extracts YouTube and Vimeo embeds supported by the existing public Markdown iframe sanitizer from article Markdown, and normalizes them to their canonical source URL. It rejects non-HTTPS/unapproved iframe destinations for **this matching operation**, leaving unsupported embedded providers under the existing public sanitizer behavior.
2. `assertExternalVideoSourceRights` requires that each recognized external-video embed have an exact canonical URL match in that **same revision's** editorial source records, with nonempty public attribution and private rights-reference fields. The rights-reference value is not emitted into public article HTML.
3. `submitEditorialForReview` now reads draft snapshot and revision source records within its existing transaction, and blocks submission when a recognized external embed has no matching rights evidence.
4. `publishApprovedEditorial` repeats the server-side check against the immutable approved snapshot/revision sources inside the publication transaction. This defends against bypassing the client editor or changing rights/source associations between editorial stages.
5. `tests/media-legacy-source-security.test.cjs` extracts the real helper into a Node VM and checks canonical YouTube/Vimeo extraction, matching records, missing source, missing attribution, missing rights reference and ordinary no-video articles. It also asserts both action callsites.

Commits: `52224c65263b5bfdf787717d11db3ca94c5e8e50` (gate), `3182112dc942322c0d48fee5e6e6de24fc227624` (fix regex escaping), `8ab8dabe7394584c3d09acda0ce77d85b144e27b` (Node VM test).

## Boundaries and limitations

- Validation covers specifically recognized **HTML iframe** YouTube/Vimeo embed shapes, matching the current public renderer. An iframe using unsupported provider/scheme/path is still governed by the existing Markdown sanitizer; this is **not** a complete provider/HTML audit, rights verification service or universal third-party-media policy.
- A source entry and rights-reference field are **documentation**, not independent legal proof of valid rights or AdSense approval. A second authorized reviewer remains responsible for eligibility.
- The M62 source-plus-unsaved-Markdown operation remains **two-step**, not atomic. If the draft is not saved, the source entry exists but the video embed does not. Source records are append-only and can be inherited on a later draft revision.
- This protection gates *new submissions and publication actions*; it does not rewrite, delete, or de-index historical published content, nor claim all existing assets have compliant metadata.
- The repo has not been cloned or its full Node suite/typecheck/Vinext build executed here; source inspection and test creation **must not** be described as runtime validation or deployed behavior.
- SQL behavior beyond the inspected schema and action queries is not assumed; database staging must test concurrent source/revision changes and transaction semantics.

## Next acceptance gates

1. Execute `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` on the current V2 branch and protected staging; fix all real failures.
2. Test draft save, source recording, submit, reject/approve, and publication; verify valid video passes and missing/revoked rights or attribution fails. Verify no private rights reference leaks to public Media HTML, social or API responses.
3. Build an atomic, concurrency-safe editor action for source+draft embed that maintains immutable revision lineage.
4. Audit real legacy video provider inventory, Stream.io room controls, fast external live worker and social rewrites; complete separate Prediction parity/cutover plan.
5. Do not enable paid Cloudflare Stream, DNS cutover, public ads, or production changes without owner approval.

No production database, DNS, bills, providers, credentials, worker, Stream.io room or ads were modified.
