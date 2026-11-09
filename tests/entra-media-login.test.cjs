const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Media sign-in stays hidden until Entra and dedicated editorial PostgreSQL are configured', () => {
  const entra = read('lib/auth/entra-external.ts');
  const postgres = read('lib/adapters/postgres-client.ts');
  const login = read('app/media-login/page.tsx');
  const authorization = read('app/lib/admin/v2-editorial-authorization.ts');
  assert.match(entra, /export function isEntraExternalConfigured/);
  assert.match(entra, /ENTRA_EXTERNAL_DISCOVERY_URL/);
  assert.match(entra, /ENTRA_EXTERNAL_ISSUER/);
  assert.match(entra, /ENTRA_EXTERNAL_CLIENT_ID/);
  assert.match(entra, /ENTRA_EXTERNAL_REDIRECT_URI/);
  assert.match(entra, /sessionKey\(\)/);
  assert.match(postgres, /export function isFactsportEditorialPostgresReady/);
  assert.match(postgres, /FACTSPORT_EDITORIAL_HYPERDRIVE/);
  assert.match(login, /isEntraExternalConfigured\(\)/);
  assert.match(login, /isFactsportEditorialPostgresReady\(\)/);
  assert.match(login, /signInReady/);
  assert.match(login, /No legacy email allowlist fallback is available/);
  assert.doesNotMatch(login, /createClient|supabase/i);
  assert.match(authorization, /readFactsportEntraSession/);
  assert.match(authorization, /No legacy admin fallback is allowed/);
});
