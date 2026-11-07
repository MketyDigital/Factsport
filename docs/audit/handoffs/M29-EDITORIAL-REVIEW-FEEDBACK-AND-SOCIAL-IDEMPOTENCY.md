# M29 — Editorial review feedback and retry-safe social scheduling

Date: 2026-11-07
Branch: refactor/factsport-v2

## Editorial review changes

Migration 0021 adds a bounded review_comment to each editorial revision and extends the editorial audit action set with review_rejected.

The CMS now supports:
- Editor approval with an optional review note.
- Editor rejection/request-changes with a required explanation.
- The rejected revision remains immutable in history.
- A writer must save a new revision before resubmitting; the prior rejected revision is not overwritten.
- The article that is already published remains publicly visible while an updated revision is rejected or corrected.
- Review approval still does not publish; a distinct publisher must publish the approved revision.
- Review comments and outcomes are recorded in the same transaction as the state change.

The newsroom list surfaces review feedback so writers can respond to the exact revision outcome.

## Social schedule idempotency

The Social Publishing form now creates a request UUID once per compose attempt and retains it when a request must be retried. The server:
- Requires a valid caller-supplied idempotency UUID.
- Checks an existing publication for the same request key and verifies the actor, channel, linked article, content, link and schedule timestamp all match.
- Uses the database unique idempotency key with ON CONFLICT DO NOTHING to make concurrent duplicate submissions converge on one publication.
- Creates one outbox row and one audit event only for the first successful insert.
- Rejects reuse of a request key with different content.

This prevents a browser/network retry from silently creating duplicate scheduled posts. It does not claim provider delivery; the separate social dispatcher and provider adapters remain unprovisioned.

## Remaining gates

- Provision roles and migrations through 0021 on the isolated V2 database.
- Verify PostgreSQL uniqueness and concurrency behavior with integration tests.
- Add a full revision diff/restore experience and public renderer preview parity.
- Implement a provider dispatcher with durable claims, bounded retries, dead-letter handling, unknown-result reconciliation and provider idempotency before any social credentials or channel activation.
