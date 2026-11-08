# M32 — Entra External ID Media editor identity flow

Date: 2026-11-08
Branch: `refactor/factsport-v2`
Status: OIDC/PKCE and encrypted Media session source committed; CI validation running; tenant-specific configuration and real Entra sign-in not yet verified.

## Implemented

- `lib/auth/entra-external.ts` implements configuration-driven OIDC discovery, exact issuer matching, HTTPS endpoint enforcement, authorization code flow, PKCE S256, random state and nonce, encrypted short-lived state cookie, token exchange, RS256/JWKS signature validation, issuer/audience/nonce/expiry validation and encrypted eight-hour Factsport session.
- Login is invite/link-only: callback resolves `(issuer, subject)` against `public.external_identities` using the dedicated editorial PostgreSQL connection. Email is informational only and never links or creates an account.
- `app/api/auth/entra/start/route.ts`, callback and logout routes implement login start, callback and session clearing.
- `app/media-login/page.tsx` is a dedicated Media-host editor entry point and does not use the private Prediction login layout.
- `app/lib/admin/v2-editorial-authorization.ts` now decrypts the Entra Factsport session and rechecks the issuer+subject+internal UUID mapping before querying active Factsport Media memberships for every protected action.
- `middleware.ts` skips the legacy Supabase/email allowlist only when the Entra session cookie is present. This cookie-presence check is not authentication: the admin layout and every protected Media action verify the encrypted session and Factsport role server-side.
- `app/admin/layout.tsx` now uses the Media RBAC workspace capability rather than requiring a Supabase user session.

## Required configuration — values must come from the created Entra external tenant/app registration

- `ENTRA_EXTERNAL_DISCOVERY_URL`: exact HTTPS OIDC discovery URL from the registered external tenant.
- `ENTRA_EXTERNAL_ISSUER`: exact `issuer` value from that discovery document.
- `ENTRA_EXTERNAL_CLIENT_ID`: public browser application client ID.
- `ENTRA_EXTERNAL_REDIRECT_URI`: exact HTTPS callback registered in Entra, matching `/api/auth/entra/callback` on the deployed Media host.
- `FACTSPORT_AUTH_SESSION_SECRET`: cryptographically random 32-byte key encoded as base64url; store as a server-only Cloudflare secret.
- `FACTSPORT_EDITORIAL_HYPERDRIVE`: dedicated writer binding with the minimum SELECT grants required for identity mapping and Media membership checks.

No tenant, app registration, issuer, client ID, callback or secret was created or guessed in this code change. No production credentials or DNS were changed.

## Security and remaining validation

- Validate discovery issuer and HTTPS endpoints; ID token signature is checked against remote JWKS with RS256, exact issuer, client audience, expiry, issued-at and nonce. Multi-audience tokens require matching `azp`.
- State is encrypted and short-lived; verifier is held in the encrypted state cookie; PKCE S256 is mandatory. Return destinations are constrained to same-origin relative paths.
- Factsport internal UUID and Media roles remain authoritative. Unknown external identities are rejected; no email auto-link, implicit user creation or role claim trust.
- Session cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, host-only and eight hours maximum. Logout clears both session and state cookies.
- Need test actual Entra discovery/JWKS/token exchange, wrong issuer/audience/nonce/signature, state replay, PKCE failure, account not linked, revoked membership, session expiry, logout and Media-host routing.
- Need confirm the deployed Media host, configure the Entra app and Cloudflare secrets, and provision editorial Hyperdrive before any live editor sign-in test.
- No social dispatcher, CMS database migration or R2 upload was activated by this identity work.