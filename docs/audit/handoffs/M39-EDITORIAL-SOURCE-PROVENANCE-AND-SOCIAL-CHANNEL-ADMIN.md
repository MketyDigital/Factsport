# M39 — Editorial source provenance and guarded Social channel administration

Date: 2026-11-09
Branch: refactor/factsport-v2
Status: source implementation committed; current CI verification is running; migration 0033/0034 are not applied.

## Editorial source provenance

- Added addEditorialSource as an append-only CMS action. It validates source title, HTTP/HTTPS URL, rejects embedded credentials, bounds publisher/attribution/private rights notes and records an audit event.
- The newsroom loads existing source references and allows an editor to append new references. It does not expose a delete/edit operation that could rewrite the historical provenance record.
- Migration 0033 adds public_editorial_article_sources, filtered to approved, reviewed, published articles. It exposes source title, publisher, canonical URL, attribution and access date only. Private rights_reference is deliberately excluded.
- Public source URLs are filtered to credential-free HTTP/HTTPS destinations. The public article adapter reads the new view and the article page renders a Sources & References section.

## Guarded Social channel administration

- Added social_admin capability, separate from the basic social compose capability.
- The Social workspace now lists all seeded channels, including disabled ones, and provides provider-specific non-secret configuration fields:
  - Meta Page ID
  - Buffer profile/channel ID
  - Telegram chat IDs
  - Make route key
- No page access token, bot token, Buffer token or Make webhook URL can be entered into the settings UI. Provider settings are whitelisted and the existing database check constraint continues to reject secret-like key names.
- Channel activation requires both the dedicated dispatcher readiness gate and provider-specific readiness. Image capability additionally requires provider-specific image E2E readiness. Both are fail-closed when bindings/flags are absent.
- Migration 0034 registers the new media_detached, source_added and social_channel_configured audit actions and grants the editorial writer only column-level UPDATE on channel enablement, media capability, safe settings and updated_at.
- The Social composer only offers enabled channels; image selection remains hidden for channels without verified media capability.

## Validation and activation boundaries

- Migration 0033/0034 are inventoried by CI, but not applied to any database.
- No source was imported from legacy Supabase, no rights reference is exposed publicly, no provider credentials are stored in Git/PostgreSQL, and no channel is enabled by these source changes.
- Current native build and isolated regression runs are pending for the latest social channel UI and source-provenance changes.
- Provider adapters, Logic Apps workflow, dedicated dispatcher Hyperdrive/role provisioning and delivery reconciliation UI remain outstanding.

## Remaining work

1. Verify latest TypeScript/native Worker build and full regression suite.
2. Apply migrations 0033/0034 to isolated staging only after role prerequisites and migration checksums are verified.
3. Test source creation, public source visibility, rights-reference exclusion and URL safety against real staging DB.
4. Provision channel routing IDs from an authorized legacy export; never migrate secrets to settings JSON.
5. Configure Logic Apps with secure connection references, dispatch claim/result calls, direct Meta/Telegram and Buffer/Make adapters.
6. Run provider test destinations, verify receipt parsing, retry behavior and unknown-result reconciliation. Only then set provider readiness flags and enable individual channels.


## Revision-scope hardening

- Follow-up audit found that an article-level source table could otherwise expose a source added to a draft of an already-published article before review. Migration 0035 adds revision_id to source records and redefines the public view to expose only sources attached to the latest published revision.
- Adding a source now requires a current draft revision. New draft saves carry source records forward from the previous pending/rejected revision, or seed from the latest published revision when editing a published article. Revision restore also carries the source records.
- The newsroom displays sources from the current draft revision, falling back to the latest published revision. Private rights-reference notes remain excluded from the public projection.

- Migration 0035 also backfills existing pending revisions from the latest published source list, so an already-open draft does not lose source references at cutover.
