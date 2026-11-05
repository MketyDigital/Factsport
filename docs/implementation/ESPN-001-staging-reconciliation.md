# ESPN fixture reconciliation — safe v2 groundwork

**Branch:** `refactor/factsport-v2` only. **Status:** candidate-generation primitives implemented; no live-score worker, database write, production route, or Cron change.

## Existing behavior audited

- `app/providers/MatchLiveProvider.tsx` polls an individual ESPN match every **3 seconds while live**, and every 60 seconds before kickoff. It consumes the separate `https://live-api.factsport.com/?espn_id=...` endpoint.
- `app/utils/liveFetcher.ts` deduplicates in-flight browser requests per ESPN ID; it does not provide durable cross-isolate caching.
- `app/api/live/route.ts` is the legacy batch updater. It authenticates with `CRON_KEY`, reads/writes Supabase using the service-role key, fetches ESPN scoreboard data per active league and then fetches per-match ESPN detail. Its in-memory `Map` is isolate-local and not a durable idempotency mechanism. It also fires social side effects directly.
- `.github/workflows/matchmaker.yml` calls the **production** `factsport.com/api/matchmaker` twice daily. This is legacy production behavior and is deliberately not changed.
- The v2 schedule importer uses a distinct restricted writer that cannot update `espn_id`, scores, or delete matches. It must not be reused for ESPN score writes.

## Safe implementation added

`lib/ingestion/factsport-espn-reconciliation.mjs` parses ESPN scoreboard events and produces a candidate fixture only when:
1. The ESPN event ID, date and home/away competitors are valid.
2. League and home/away order match.
3. Team names match after conservative Unicode/punctuation normalization and removal of standalone FC/CF tokens.
4. Kickoff differs by no more than three hours.
5. The fixture is a football-data-owned, unsettled schedule row in an allowed pre-match/schedule status.
6. Exactly one unlinked fixture qualifies.

Zero candidates return `no_match`; multiple candidates return `ambiguous`. The helper never mutates records or writes an ESPN ID. It reads scoreboard status from the ESPN event-level `status` object, and rejects non-football-data rows, already-linked rows, settled rows, and disallowed statuses. Scores remain nullable rather than defaulting missing provider values to zero. Unit tests cover ambiguity, reversed teams, wrong league, stale kickoff and malformed payloads.

## Why this is not yet live-score parity

A safe v2 ESPN score writer still needs a **separate least-privilege PostgreSQL role and Hyperdrive**. It should be able to update only ESPN-owned live fields on explicitly linked rows, and must not change schedule identity, settlement, points, or account tables. The existing schedule writer must remain schedule-only; the app reader remains read-only.

Before activating that worker:
- Provision and verify the score-writer role's column-level grants and negative permissions.
- Build a reviewable reconciliation report from real scoreboard events; automatically link only unique candidates and retain an audit trail.
- Define score/status ownership rules for postponed, abandoned, extra-time, penalties, corrections and provider outages.
- Use durable `job_runs`/version guards or an equivalent idempotency design; the current legacy in-memory cache is insufficient.
- Preserve the current 3-second live UI polling contract without making a 3-second full-league ESPN request storm. Separate live match detail fetch from schedule refresh and apply bounded provider request concurrency.
- Port social side effects behind an idempotent outbox rather than calling social routes before database commit.
- Add staging-only canary tests comparing ESPN events with saved v2 rows before considering production parity.

## Explicit non-actions

No production Supabase writes, production ESPN endpoint or GitHub schedule changes, production DNS, main-branch commits, prize settlement changes, or Azure Logic App activation. This document does not authorize any of them.
