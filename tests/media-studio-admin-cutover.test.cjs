const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V2 studio admin cannot use legacy Supabase settings or profile allowlists', () => {
  const actions = read('app/admin/studio/actions.ts');
  const page = read('app/admin/studio/page.tsx');
  const client = read('app/admin/studio/StudioClient.tsx');
  for (const source of [actions, page, client]) {
    assert.doesNotMatch(source, /getSupabaseAdmin|createClient|global_studio|ADMIN_EMAILS|user_metadata/);
  }
  assert.match(actions, /V2_BROADCAST_ADMIN_NOT_PROVISIONED/);
  assert.match(page, /V2 broadcast database/);
  assert.match(page, /Prediction VIP/);
  assert.match(page, /room-scoped/);
});
