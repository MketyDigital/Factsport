# ESPN live-score parity preview — read-only v2 step

**Branch:** `refactor/factsport-v2` only. **Status:** implementation and unit tests added; preview Worker is not deployed or scheduled.

## Scope

- Reads only already-linked, football-data-owned fixtures in the staging database.
- Uses the dedicated `factsport_v2_espn_writer` Hyperdrive and verifies the exact database and role identity before querying.
- Fetches ESPN scoreboard data with a concurrency ceiling of three provider requests.
- Compares linked fixture status and available score values by exact ESPN event ID.
- Treats missing provider scores as unknown; it never converts them to zero.
- Reports proposed differences only. It contains no SQL INSERT, UPDATE, DELETE, linking, settlement, or social side-effect path.

## Safety boundaries

- It does not inspect or link the 18 unapproved reconciliation candidates.
- Rows with `points_distributed=true` are excluded.
- It does not change the existing browser 3-second live polling behavior.
- It does not deploy a persistent Worker, configure Cron, touch production DNS, or modify `main`.
- The endpoint is protected by a short-lived bearer token when deployed for a future read-only preview.

## Verification

The v2 native vinext CI now runs the score parity helper tests and validates the Worker module syntax. The next operational step is a protected staging preview against already-linked rows; no score-writing worker or scheduled refresh is authorized by this implementation.


## 2026-11-06 least-privilege correction

The score-parity preview worker now verifies `factsport_v2_reader` and is configured to use the read-only runtime Hyperdrive (`895cca...`). It no longer connects through the ESPN writer identity. The dedicated ESPN writer remains reserved for a separate score-writing worker after its transaction, idempotency and parity gates pass.
