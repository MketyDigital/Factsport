# M67 — Stream.io Goal Rush room lifecycle and stale-join cleanup

Date: 2026-11-11
Branch: `refactor/factsport-v2`
Status: source implementation committed and inspected. Connected Stream.io tests, TypeScript, engine suite and native Cloudflare staging unverified.

## Scope and legacy audit

Reviewed `docs/audit/handoffs/M18-LEGACY-MEDIA-PLAYER-LIVE-STUDIO.md`, `M26-MEDIA-STUDIO-AND-STREAMIO-BROADCAST-MODEL.md`, `M53-LEGACY-STREAMING-NO-PAID-CF-STREAM.md`, `app/providers/GlobalMediaProvider.tsx`, `app/components/FactSportMediaRoom.tsx` and broadcast admin actions. The Global Goal Rush and match-specific audio rooms, anonymous listeners, logged-in callers, 24-hour invited guests, host/moderator tools and Stream.io SDK belong to the Factsport.com **Media** system, not premium Prediction/VIP. Do **not** equate Stream.io with the separately billed and unapproved Cloudflare Stream hosted VOD product.

## Confirmed functional gap

The V2 global media provider used React render-state `call` and `client` from closures when `stopMedia()` ran; cleanup on unmount captured older values. A client still joining or waiting for the host could be absent from that state, so switching media or unmounting could leave Stream.io SDK connections or room polls alive. The 4-second waiting-room interval could also retry while a previous `join()` had not finished, and an old audio request could resume after a newer video selection while the prior disconnect was pending.

## Implemented

1. Added refs for the in-flight/current Stream.io client and call, a session counter and typed polling interval in `app/providers/GlobalMediaProvider.tsx`. `stopMedia` invalidates the session, clears the polling timer, reads-and-clears the actual refs, resets UI state and disconnects the old call/client.
2. `tuneInAudio` guards the async disconnect boundary with a stopped-session token so a subsequent media selection cannot be superseded by an older request.
3. Once token issuance succeeds, the provider tracks the newly created SDK client/call immediately rather than only after joining. A late initial `join()` that finishes after a media switch now explicitly leaves/disconnects its obsolete room.
4. Waiting-for-host retry has an in-flight guard to avoid overlapping Stream.io `join()` requests; hidden-tab CPU/network skip remains. Late successful retries for a replaced session are disconnected rather than publishing stale room state.
5. The existing authenticated `/api/studio/token`, roomKey/invite-token request, host-only `join({create:true})` and separate caller-permission decision remain unchanged.
6. Added `tests/streamio-global-media-lifecycle.test.cjs` with source-regression assertions for ref-based teardown, session cancellation, nonoverlapping polling, stale join cleanup and token/caller gating.

Commits:
- `7e06f8820967d55734549ade0d83d79dea94fad5` — ref-based disconnect and stale/poll lifecycle guard.
- `5a94815533da4698949ad4c2725a4ceb68507c6f` — guard async disconnect boundary and late Stream.io joins.
- `f4e4d257d081ce265fd2ed1b2327f0e4f77edf3c` — regression source assertions.

## Verification boundary

Fetched the committed provider, source tests and paid Cloudflare Stream adapter from the V2 branch, checked presence of active-call/client tracking, old-client leave/disconnect, stale-session checks and single-flight polling. The paid Stream VOD hard-off source constant remains present.

The checks above are **not** actual `node --test` execution, SDK interaction tests, production room state, or browser lifecycle verification. The local repository is not available to run a native build in this session; no CI status is claimed as passing. The regression tests are structural checks and do not simulate connected SDK behavior.

## Outstanding tests and follow-ups

1. Run `npm run test:engine`, `npm run typecheck`, `npm run build:vinext` on V2 head and protected Cloudflare staging.
2. Exercise anonymous listener join, repeated clicks, failed join, waiting host, host-start transition, rapid room switch, video switch, hidden tab, unmount and reconnect with actual Stream.io private test calls; inspect provider participant counts for orphan connections.
3. Verify host/moderator grant/revoke, signed invite expiry, room binding and call-in mic grant/revoke under the independently authorized Media broadcast roles. Avoid changing live rooms before approval.
4. Audit the fast external live-data worker that supplies public match refresh, its rewrite/normalization and social publication pathways; preserve Media vs Prediction ownership and scoring parity.
5. Continue legacy Media/CMS inventory, R2 and AdSense-sensitive public publication, media provenance and full cutover gates without provisioning paid Cloudflare Stream hosted VOD.

No production DNS, live database, Stream.io rooms, secrets, Cloudflare billing, public advertising or infrastructure deployment changed.
