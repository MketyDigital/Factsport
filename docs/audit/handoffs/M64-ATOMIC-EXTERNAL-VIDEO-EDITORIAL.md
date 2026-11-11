# M64 — Atomic external-video editorial attachment

Date: 2026-11-11
Branch: `refactor/factsport-v2`
Status: code and source tests committed; real database/TypeScript/CI/browser acceptance NOT yet verified.

## Context

M62 introduced YouTube/Vimeo editorial authoring, initially writing a provenance record before editing the unsaved article body. M63 gated new review and publication against matching revision-scoped source, attribution and private rights reference. That two-step M62 workflow could leave orphan source records when an editor navigated away before saving, and could race with other editors.

Owner instructions remain binding: Factsport.com Media is primary; Stream.io live and R2 media are approved; separately billable Cloudflare Stream hosted VOD is rejected and source-disabled. Maintain public Media content rules, the external fast live worker and separate Prediction business domain.

## Changes

1. Added `attachExternalVideoToDraft` server action in `app/admin/news/actions.ts` behind `authorizeMediaEditorialAction('draft')`.
2. Validates HTTPS provider host and canonical video identifiers: YouTube watch, live, shorts, embed, youtu.be; and Vimeo numeric video IDs. The action derives the canonical source URL and allowlisted iframe embed itself rather than trusting client-provided embed HTML.
3. Requires public attribution and a private rights/permission reference. Rights remain in the existing private `editorial_article_sources` revision record, not the public Markdown.
4. Wraps article lock, latest draft revision lock, current-body concurrency check, source insert, draft snapshot update, permitted unpublished article-body update and editorial audit in **one existing editorial Postgres transaction**.
5. If the body differs from the expected editor body, the transaction rejects the request; the editor must save/reload. No partial provenance row/embed should be committed on transaction failure.
6. Uses existing `source_added` audit-event name with `mediaKind: 'external_video'` in details to avoid assuming a new audit action type is allowed by database constraints.
7. Rewired `NewsroomClient.tsx` to call the atomic action and reload on success, eliminating the source-first / unsaved body append path. Reviewed/published revisions cannot be edited directly.
8. Updated `tests/media-legacy-source-security.test.cjs` to check the new action, authorization, transaction, locks, conditional unpublished article update and client wiring; earlier parser and M63 review/publish checks remain.

Commits:
- `3e6542276910512b3a8b899079ce63ee8326245f` — atomic server action
- `699f1c971c8a6d6ca18d115dbfd71ae928d7e79e` — newsroom integration
- `05ea6fc87c2133745ef5d1053e11f4685558eb90` — regression assertions
- `488517028428d3a73b59e802467a59d1d6af1c6d` — use established audit event

## Verification

Fetched current-branch server action, client and tests and inspected their transaction/lock sequence, stale-body guard, existing audit event, canonicalization, and R2/Media editorial coexistence. **Did not execute** Node test suite, typecheck, Vinext build, connected PostgreSQL transaction, protected Cloudflare staging or end-to-end browser editor flow. These remain release blockers.

## Remaining limitations

- Body equality protects against overwriting a changed article body but is not a full optimistic revision token for fields outside the body. An editor with unsaved headline/SEO changes should save those before attaching. A future extension should pass and validate a revision ID/version and preserve dirty editor state.
- The action edits the current **draft** revision snapshot in place. That revision is not yet immutable/reviewed; the established editorial revision lineage is still created when a draft is explicitly saved. The published revision remains untouched when a new draft is attached to an existing published article.
- Source metadata records editor claims; it cannot independently prove a licence, and human editorial approval/rights review remains necessary.
- M63 handles recognized YouTube/Vimeo HTML iframe formats, not a complete historical media/provider inventory. The public sanitizer remains the ultimate embed allowlist, and historical published content was not rewritten.
- Real database validation must confirm migration versions, audit-event constraints, snapshot update permissions and expected `RETURNING`/row counts.
- No paid Cloudflare Stream VOD, production data, DNS, AdSense settings, other credentials or live Stream.io services were changed.

## Next gates

1. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext`, protected Cloudflare staging.
2. Browser/database test atomic attachment, stale-editor collisions, rollback on invalid rights, source+snapshot consistency and review/publish gates.
3. Add stable revision version/ID concurrency checks; align all editor state and automatic refresh behavior.
4. Audit legacy embedded hosts, external live worker rewrite rules, Stream.io studio and Media/social/Prediction parity against full roadmap before cutover.
