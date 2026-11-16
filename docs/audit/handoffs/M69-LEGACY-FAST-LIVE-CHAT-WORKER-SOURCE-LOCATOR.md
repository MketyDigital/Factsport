# M69 — Verified legacy fast-live and chat source locator

> **2026-11-16 update:** Superseded by [M70](M70-ORIGINAL-FAST-ESPN-CHAT-WORKERS-POSTGRES-NO-D1.md). The owner has now provided both exact original Worker files; they are archived byte-for-byte under `docs/audit/legacy-source/external-chat-d1-worker-v1.js.txt` and `external-fast-espn-motm-d1-worker-v1.js.txt`. The missing-source conclusion below describes the M69 audit snapshot, not the current branch.


Date: 2026-11-15
Branch: `refactor/factsport-v2`
Scope: **repository-wide current-tree inventory**, not a full Git historical-object or deployed Cloudflare account audit.
Evidence: GitHub Git Trees API recursive read of the **entire** V2 branch HEAD `8352e6d64577567650134412f3cc0cd10d7c98ea`, `truncated:false`, 521 blobs; analogous main tree had 243 entries. Checked exact file source and audited notes.

## Source files retained on V2

- `app/utils/liveFetcher.ts` — complete legacy **browser client** with request coalescing, cache busting and calls to `https://live-api.factsport.com/?espn_id=...`.
- `app/providers/MatchLiveProvider.tsx` — complete legacy **match-page client provider**: 3s live / 60s other polling, seeded initial data, merging scores, clock, stats, lineups and event arrays.
- `app/components/LiveScoreLabel.tsx` — separate legacy fast score consumer; documented 10s live / 60s otherwise.
- `app/components/FanZoneChat.tsx` — complete legacy **chat frontend** with `https://chat-api.factsport.com` calls, messages, moderator/pin/UI features.
- `app/components/MOTMVoteWidget.tsx` — complete legacy MOTM frontend using external live Worker.
- `docs/audit/legacy-source/api-live-route-v1.ts.txt` — archived full legacy Supabase-backed **background DB-sync** route formerly at `/api/live`. This is **NOT** the fast ESPN viewer Worker. Its original credential query and social side effects must never be reactivated unchanged.
- `docs/audit/WORKERS-001-external-workers-and-consolidation.md` and `docs/audit/handoffs/M20-FAST-EXTERNAL-LIVE-WORKER-AND-FRONTEND-DATA-PATH.md` — behavior and architecture of the **owner-supplied** external ESPN fast proxy (+ D1 MOTM), chat D1 Worker, scheduled orchestrator and external cron service.
- `workers/factsport-espn-score-preview.mjs` and `workers/factsport-espn-reconciliation-preview.mjs` — V2 private **preview** workers; these are not copies of the old public ESPN fast proxy or chat Worker.
- `app/api/media/live-scores/route.ts` and `app/components/LiveMediaClient.tsx` (M68) — new coarse DB snapshot refresh; **not** a 3-second ESPN frontend replacement.
- `app/api/live/route.ts` — intentionally disabled legacy background write route on V2.

## Crucial source distinction

The recursive current-HEAD tree contains **no standalone complete external deployed `live-api.factsport.com` ESPN proxy+MOTM Worker entrypoint or `chat-api.factsport.com` D1 Worker entrypoint**. The WORKERS-001 note says the owner provided three external Worker definitions in conversation, with the fast live/MOTM source in an uploaded text file. The note contains architectural summaries and no verbatim fenced source. M20 explicitly states the external Worker code was **not checked into the V2 repository** when audited.

This does not prove those sources never existed in previous Git objects, private external repositories, uploaded material in older conversations, or Cloudflare deployments. Their **complete deployed code** has not been recovered and compared from the current V2 tree. Do not describe an implementation reconstructed from the notes as byte-for-byte or behavior-complete parity.

## Distinct original responsibilities to preserve

1. Fast public ESPN live read: ESPN summary, 3s live CDN caching, 60s scheduled / 3600s finished intent, normalized scores/status/clock, commentary-derived events, team/player stats, lineups, venue/referee and legacy prediction-related source fields where legally and architecturally appropriate. Distinguish Prediction-only data.
2. Chat D1 Worker: GET last 50 messages, reverse chronology for display, cache by match/status; POST inserted user-supplied message/identity. Identity spoofing, CORS wildcard, moderation and rate limits in legacy Worker must be fixed rather than carried forward.
3. MOTM D1 in ESPN Worker: vote totals and upsert endpoint. Client-only eligibility is inadequate; V2 must use verified participant/candidate rules and atomic uniqueness.
4. External background cron `/api/live`: independently ingests/repairs match data and attempts social notifications; must become an authorized durable writer/outbox, **not** a browser refresh endpoint.

## Next steps / checks

- If byte-for-byte legacy comparison is required, recover original ESPN fast/MOTM and chat Worker scripts from the **actual Cloudflare account scripts or owner's original uploaded text file**. Use read-only authorized export; no production deployment or provider calls should be triggered by the audit.
- Independently inspect exact deployed routes, Cache API behavior, D1 binding/schema, ESPN provider quotas, CORS, chat access controls, MOTM rules and cron triggers before proposing cutover.
- Build V2 same-origin fast reader and authenticated chat/MOTM modules using documented behaviors and regression fixtures. Preserve live 3s UI parity and separate one-minute snapshot writer/social outbox.
- M68's DB refresh is only a conservative additional score path, not a substitute for this work.
- No production, DNS, database, Worker, D1, Stream.io or billing changes were made for this inventory.

Evidence is source-inspected, **not** Cloudflare runtime verified.
