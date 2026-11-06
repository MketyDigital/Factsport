# Factsport v2 Hyperdrive and database-role privilege matrix

**Updated:** 2026-11-06  
**Branch:** `refactor/factsport-v2`  
**Environment:** isolated `factsport_v2` staging database.

## Hyperdrive identity map

The four IDs serve different purposes; they are not conflicting bindings.

| Hyperdrive ID | Name / purpose | Origin role | Bound to |
|---|---|---|---|
| `895cca4c06104b8ab9f7c1b72a8ba18f` | `factsport-v2-runtime-postgres` — application read path | `factsport_v2_reader` | vinext app staging, DB/R2 smoke, ESPN reconciliation and score-parity previews |
| `eb634fef8bb443839fd0847c6c370f85` | `factsport-v2-schedule-postgres` — scheduled fixture import | `factsport_v2_schedule_writer` | schedule sync Worker |
| `c5166b8496624a80a0a77c750585c271` | `factsport-v2-espn-postgres` — reserved live-field writer | `factsport_v2_espn_writer` | ESPN writer privilege verifier; no live score-writing Worker is authorized by this audit |
| `08cee41a81be4c3980450be9563af5e2` | `factsport-v2-postgres` — administrative/bootstrap connection | `mketydbadmin` | temporary role provisioning, read-only catalog audit and staging role hardening only; never bind this to the application or scheduled data Workers |

The earlier audit note that described `08cee...` as historical/unverified is superseded: the current hardening workflow verifies its exact name, database, origin user and TLS mode before role changes.

## Verified runtime role attributes

The read-only catalog audit [42265113422](https://github.com/MketyDigital/Factsport/actions/runs/42265113422) inspected PostgreSQL catalog metadata only.

| Attribute | Reader | Schedule writer | ESPN writer |
|---|---:|---:|---:|
| LOGIN | Yes | Yes | Yes |
| SUPERUSER | No | No | No |
| CREATEDB / CREATEROLE | No | No | No |
| REPLICATION | No | No | No |
| BYPASSRLS | No | No | No |
| INHERIT | No — NOINHERIT | No — NOINHERIT | No — NOINHERIT |
| Connection limit | 5 | 5 | 5 |
| Role memberships | None | None | None |
| Database CONNECT | Yes | Yes | Yes |
| Public schema USAGE | Yes | Yes | Yes |
| Database CREATE / schema CREATE | No | No | No |
| Public schema function EXECUTE | None | None | None |
| Public sequence USAGE | None | None | None |
| Private table access (`app_users`, `external_identities`, `job_runs`) | None | None | None |

## Exact match table privileges

All three roles have table-level SELECT on `public.matches`. None has table-level INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES or TRIGGER. The write paths are granted by column, not table.

| Role | INSERT columns | UPDATE columns |
|---|---|---|
| `factsport_v2_reader` | None | None |
| `factsport_v2_schedule_writer` | `api_id, away_logo, away_team, home_logo, home_team, league, match_date, match_group, source, source_updated_at, stage, status, venue` | `away_logo, away_team, home_logo, home_team, league, match_date, match_group, source_updated_at, stage, status, venue` |
| `factsport_v2_espn_writer` | None | `away_score, espn_id, home_score, match_events, source_updated_at, stats, status, updated_at, version` |

The schedule writer's unnecessary INSERT permission on `home_score` and `away_score` was revoked by staging hardening run [42263796103](https://github.com/MketyDigital/Factsport/actions/runs/42263796103). The schedule Worker now verifies that it cannot insert or update scores or alter `points_distributed`; [42264186975](https://github.com/MketyDigital/Factsport/actions/runs/42264186975) passed. The ESPN verifier checks its exact limited live-field privileges; [42264640003](https://github.com/MketyDigital/Factsport/actions/runs/42264640003) passed.

## Remaining database-level detail

The audit observed that all three runtime roles could create temporary tables because PostgreSQL's database TEMP privilege was inherited from PUBLIC. No Worker uses temporary tables. A follow-up hardening attempt is testing revocation of that default PUBLIC grant; until it passes, keep this as a low-priority residual privilege and do not claim it has been removed.

The current role migration is `db/migrations/0002_factsport_v2_runtime_role_hardening.sql`. It is staging-only until the same migration is deliberately approved and validated against the production database. The admin Hyperdrive credential must remain isolated to provisioning/audit workflows.
