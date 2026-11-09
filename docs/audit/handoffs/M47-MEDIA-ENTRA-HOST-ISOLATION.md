# M47 — Media Entra host isolation and fail-closed sign-in

Date: 2026-11-09
Branch: refactor/factsport-v2
Source checkpoint: 5e87b07c098c19e7cc037ea7acefa56c49f9b473
Status: isolated verification passed; native build and protected staging were still running when this handoff was written. No Entra tenant or production configuration was changed.

## Implemented

### Readiness and host binding

- Added `isEntraExternalConfigured()` to validate required discovery URL, issuer, client ID, HTTPS callback URI, exact callback path and the application session secret.
- Added `isFactsportEditorialPostgresReady()` to verify the dedicated editorial Hyperdrive binding exists before Media sign-in is offered.
- Added `isEntraMediaRequestHost()`; OIDC start and callback requests must arrive on the exact origin registered in `ENTRA_EXTERNAL_REDIRECT_URI`.
- The Media login page now displays the Microsoft sign-in button only when Entra configuration, editorial Hyperdrive and current request host all match. Otherwise it displays a clear provisioning message; no legacy email allowlist fallback is offered.
- Media login and Media admin return not-found on the configured private Prediction host. Private host normalization accepts either a hostname or an HTTPS URL consistently across middleware, root metadata and server guards.

### Middleware ownership separation

- Public Media requests no longer instantiate or refresh a Supabase SSR session in middleware.
- An unauthenticated `/admin` request on the Media host redirects to `/media-login`.
- Presence of the `__Host-factsport_media_session` cookie is only a routing hint; the Media admin layout and every protected action still decrypt/validate the signed Entra session and re-check database membership/role.
- The private Prediction host alone retains the legacy Supabase session refresh while its separate account migration is outstanding.
- Media admin, Media login and Entra routes return 404 on the private Prediction host.
- This removes the old middleware redirect to the generic Supabase `/login` page for Media editors.

### OIDC and sign-out hardening

- Entra start and callback routes reject requests from any origin other than the configured Media callback origin.
- Logout is now a same-origin POST and clears the host-only session/state cookies; the admin layout submits a form instead of using a GET link.
- The `__Host-` cookie remains Secure, HttpOnly, host-only and SameSite=Lax for the OIDC top-level callback flow.

### CI coverage

- Expanded `.github/workflows/v2-verify.yml` path filters to include `app/api/auth/**`, `app/media-login/**`, `app/lib/**`, `app/auth/**`, `app/login/**`, `app/register/**`, `app/lib/supabase/**`, `lib/auth/**`, `lib/security/**`, `middleware.ts` and `types/**`.
- Added `tests/entra-media-login.test.cjs` covering readiness gates, exact host binding, same-origin POST logout, private host exclusion and the public Media middleware bypass.

## Verification

- Isolated verification passed on source commit `5e87b07c098c19e7cc037ea7acefa56c49f9b473`, run [42575473484](https://github.com/MketyDigital/Factsport/actions/runs/42575473484). Engine regression, TypeScript, anonymous prediction/consent schema contract and migration inventory checks passed.
- Native Vinext build run [42575473599](https://github.com/MketyDigital/Factsport/actions/runs/42575473599) was still building at handoff time.
- Protected Cloudflare application staging run [42575473528](https://github.com/MketyDigital/Factsport/actions/runs/42575473528) was pending at handoff time.

## Remaining owner/provisioning acceptance

1. Provision the Entra External ID tenant and Media app registration; register the exact HTTPS callback URI on the intended Media host and configure MFA/conditional-access policy.
2. Install the discovery URL, issuer, client ID, redirect URI and high-entropy session secret as Cloudflare Worker secrets/vars. Never commit their values.
3. Provision `FACTSPORT_EDITORIAL_HYPERDRIVE` with the dedicated `factsport_v2_editorial_writer` role; apply/verify the editorial migrations and effective grants in isolated Azure staging.
4. Run real OIDC E2E for state, nonce, PKCE, issuer/audience, callback origin, cookie issuance/rotation, logout, role revocation and stale/invalid sessions.
5. Keep the private Prediction account on its separate migration track. Its legacy Supabase session refresh is not Media admin authorization and must not be mistaken for final V2 Prediction identity parity.

## Safety

No Entra tenant, app registration, secret, Cloudflare API token, Cloudflare 2FA setting, challenge setting, DNS, database, production Worker or user account was changed. No live sign-in is claimed until owner provisioning and real OIDC E2E pass.
