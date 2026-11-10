# M53 — Owner correction: no Cloudflare Stream paid VOD adoption

Date: 2026-11-10
Branch: `refactor/factsport-v2`
Status: owner constraint; architecture correction and audit note. No provider or infrastructure activated.

## Owner direction

Cloudflare Stream (paid hosted VOD/transcoding product) has **not** been approved for Factsport V2 and is **not** the legacy media provider. Do not purchase, provision credentials, activate Stream Video, upload media, apply Stream-specific migrations to live infrastructure, or test with billable provider operations without a new explicit owner decision. The preceding M50/M52 VOD/TUS work is a speculative, disabled implementation branch slice, **not an approved launch requirement**.

The existing Cloudflare platform credentials are for Cloudflare infrastructure generally; they must not be construed as authorization to enable the separately billed Stream product.

## Legacy evidence verified directly on main

- `app/components/FactSportPlayer.tsx`: YouTube embeds, direct MP4/WebM/OGG/MP3/M3U8/WAV, generic iframe fallback, and `streamio` room sentinel.
- `app/components/EmbedPlayerClient.tsx`: the match/embed player delegates to `FactSportPlayer`, with media URL from legacy settings and match context.
- `app/components/FactSportMediaRoom.tsx`: `@stream-io/video-react-sdk` for the live studio, broadcast call, participants, raise-hand and moderator interactions.
- `docs/audit/handoffs/M18-LEGACY-MEDIA-PLAYER-LIVE-STUDIO.md`: audited match player, Goal Rush studio, global room and Stream.io identity.
- `docs/audit/handoffs/M26-MEDIA-STUDIO-AND-STREAMIO-BROADCAST-MODEL.md`: V2 Stream.io studio/broadcast ownership and roles.
- `app/providers/GlobalMediaProvider.tsx` on V2: `@stream-io/video-react-sdk`, audio rooms and first-party token issuance.

## Provider distinctions

- **Stream.io**: existing third-party live audio/video-room SDK and token/call-in workflow. Retain and harden existing features subject to its separately applicable plan/cost.
- **YouTube / externally authorized media URLs / HLS / raw media**: the existing media player input formats. Preserve approved integrations, server-side URL validation, rights and publisher-policy gates.
- **Cloudflare R2**: already-planned asset/object storage for still-image workflows; do not conflate with Cloudflare Stream.
- **Cloudflare Stream**: new optional paid hosted VOD/transcoding and signed playback work in M41/M50/M52. Not approved for launch; feature flags must remain off. No live provider staging exercise is authorized.

## Corrected priority

1. Audit and preserve legacy media URL/YouTube/HLS/Stream.io behavior, security and source ownership. Improve player, CMS, editorial rights, embed validation, previews, mobile/audio performance, and Stream.io admin controls without Cloudflare Stream dependency.
2. Any VOD upload feature for the CMS must be re-specified using an owner-approved storage/delivery path (e.g., authorized embeds, existing infrastructure and bounded object storage as justified); do not silently replace it with another paid media service.
3. Keep `FACTSPORT_STREAM_VIDEO_READY` and `FACTSPORT_MEDIA_VIDEO_SCHEMA_READY` unset. The current paid Stream source may remain dormant for controlled review, but must not be a release gate and must not silently surface as the main Media upload path.
4. Record a separate cost and implementation assessment if a new VOD provider is ever proposed. Require explicit approval before provisioning/billing.
5. Verify Cloudflare account billing/service configuration with an authorized account read-only audit if available; repository inspection alone cannot certify the absence of billable resources.

## No changes made

No production Cloudflare, Stream.io, R2, DNS, Azure, billing, database, advertising or user records were changed. This document records the clarified restriction and supersedes the assumption in M51/M52 that paid Stream VOD provider integration should be the next stage.
