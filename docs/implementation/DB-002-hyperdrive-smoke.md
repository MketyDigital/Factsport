# Hyperdrive staging integration (read-only)

The user created Cloudflare Hyperdrive configuration `factsport-v2-postgres` (ID `08cee41a81be4c3980450be9563af5e2`) for Azure PostgreSQL `mketypostgres`, database `factsport_v2`, with TLS mode require. No password or full connection URI is tracked in git.

## Isolated staging smoke Worker

`wrangler.hyperdrive-smoke.jsonc` creates a **separate staging-only Worker** called `factsport-v2-db-smoke`; it does **not** deploy the Next.js app, replace the production Worker or move the live 3-second ESPN pathway. Cloudflare Hyperdrive credentials are resolved from the binding at runtime.

1. In a local terminal with a Cloudflare account authenticated to Wrangler, run `npm install`.
2. Configure a long random token using `npx wrangler secret put FACTSPORT_SMOKE_TOKEN --config wrangler.hyperdrive-smoke.jsonc`. Never commit or paste its value into logs/chat.
3. Deploy **only** the separate staging Worker: `npx wrangler deploy --config wrangler.hyperdrive-smoke.jsonc`. This creates/updates a Cloudflare Worker and can incur usage charges; inspect Cloudflare account settings before running.
4. Request `GET /__internal/db-smoke` on the returned staging workers.dev URL with `Authorization: Bearer <token>`. A successful response is `{ "ok": true, "database": "factsport_v2", "matchesTableReady": false }` until migration 0001 is applied; afterward `matchesTableReady` should be true. Unauthorized requests return 404. Requesting `/` also returns 404.
5. If you get 503, verify Azure server Ready, Hyperdrive host/database/role, firewall allowlist and TLS. Do not share credentials or full driver errors.

## Remaining integration

- The currently checked-in application still uses Next.js 14 and the legacy Cloudflare Pages adapter. **Do not** change its Wrangler `main` to the generic `src/index.ts` example: that file does not exist in the app.
- When the app is upgraded for vinext, its real Wrangler `main` should be `vinext/server/app-router-entry` with `HYPERDRIVE` bound to the ID above, and app server-only queries can access `env.HYPERDRIVE.connectionString` using `cloudflare:workers`. Run vinext compatibility, build and route tests first.
- `DATABASE_URL` GitHub Actions secret does not grant access to the Azure DB from GitHub-hosted runners or propagate automatically into Cloudflare. Use a separately configured Hyperdrive runtime binding and least-privilege PostgreSQL user.
- Hyperdrive connection limit should initially be around five for shared B1ms, caching off for user-dependent/settlement data. The user must confirm those dashboard settings.
- No schema migration or role creation was run here. The smoke Worker is read-only and should be removed after integration checks are complete.
