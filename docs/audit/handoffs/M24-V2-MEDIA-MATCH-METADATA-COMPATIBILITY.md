# M24 — V2 Media match metadata and frontend compatibility projection

Date: 2026-11-07
Branch: refactor/factsport-v2
Status: additive schema and PostgreSQL read adapters implemented; migration not yet applied and backend flag not enabled.

## Legacy fields that must not disappear

M18 verified the legacy Media player and live frontend depended on:
- Live display clock and provider widget identity.
- Match video replay URL, live video URL, live audio URL, media URL, stream URL and audio/video mode.
- StreamIO sentinel support.
- Public chat pin text and link.
- Server-side 15-minute pre-kickoff playback lock, live/finished mode selection and URL validation.
- The match page's score/events/stats/lineups plus Media playback metadata.

These are Media capabilities. Prediction analysis (pro_analysis), paid VIP state, campaign fields and settlement flags are deliberately not included in this Media projection.

## V2 data model added in migration 0017

- matches.display_clock, clock_updated_at, and provider_widget_id preserve live clock/provider-widget fields.
- match_media stores video replay, livestream, audio, media/stream URLs and mode separately from core match results.
- Media URL rows are private by default and require explicit rights review before public projection. Public reads exclude expired rights.
- match_public_pins and public_match_pins separate public match pin copy from media licensing; pin text/link are no longer hidden behind the media rights gate.
- public_match_media and public_match_pins are narrow public views. Reader role receives view access, not base table access.
- ESPN live writer can update only display clock and clock timestamp; it cannot modify editorial media URLs.
- Editorial writer can manage match media and pins. It receives no Prediction grants.

## Read adapters updated

- getPostgresMatchById now joins the rights-cleared media and public pin views and returns the old frontend-compatible data names.
- /api/match-data has a PostgreSQL branch mapping display_clock back to displayClock and provider_widget_id to widget_id, while retaining score/events/lineups/stats and the 5s/60s/3600s cache policy.
- /api/match/[id]/playback has a PostgreSQL branch that retains the server-side unlock, finished/live selection and URL safety checks.
- /api/cache/match-widget and /api/match/pin have PostgreSQL branches.
- These routes fail closed in staging when the PostgreSQL backend flag is absent; they do not silently fall back to legacy Supabase in staging.
- The existing V2 public /api/matches and competition matches readers remain backed by the V2 PostgreSQL adapter when their backend flag is enabled.

## Activation gates

1. Apply migrations 0008 and 0017 to the isolated V2 database in order and verify all grants.
2. Add the dedicated Media editorial writer binding before any match-media or pin writes.
3. Enable FACTSPORT_MATCH_DETAIL_BACKEND=postgres only after migration and Hyperdrive health pass.
4. Test match data, player page, widget, pin and playback endpoints with authorized staging requests.
5. Test YouTube, HLS, MP4, WebM, audio and StreamIO sentinel playback; test expired/rejected media and malicious URL rejection.
6. Import legacy Media fields through a field-by-field reconciliation process. Do not copy prediction analysis into Media.
7. Build global Goal Rush studio settings and StreamIO room/invite lifecycle as a separate Media broadcast capability; migration 0017 does not yet implement global studio or guest invite tables.
8. Do not change the production frontend, DNS or existing live Worker until parity passes.

## Validation boundary

The pure source tests cover the compatibility schema, reader joins and route branches. Migration 0017 has not been applied, role grants have not been audited against a live target database, the editorial Hyperdrive binding is not provisioned, and the new playback branch has not been runtime-tested. The current staging deployment does not expose these routes through its public allowlist.
