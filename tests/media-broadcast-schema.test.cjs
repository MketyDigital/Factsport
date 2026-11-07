const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Media broadcast schema separates public listening, room roles, guests and Prediction VIP', () => {
  const sql = read('db/migrations/0019_factsport_media_broadcast_rooms.sql');
  assert.match(sql, /global-goal-rush/);
  assert.match(sql, /is_active boolean NOT NULL DEFAULT false/);
  assert.match(sql, /public_listening_enabled boolean NOT NULL DEFAULT true/);
  assert.match(sql, /callin_enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql, /token_hash char\(64\) NOT NULL UNIQUE/);
  assert.match(sql, /expires_at timestamptz NOT NULL/);
  assert.match(sql, /revoked_at timestamptz/);
  assert.match(sql, /max_uses integer/);
  assert.match(sql, /identity_kind IN \('anonymous', 'authenticated', 'guest'\)/);
  assert.match(sql, /role_key IN \('listener', 'caller', 'guest', 'host', 'moderator'\)/);
  assert.match(sql, /mic_granted_by/);
  assert.match(sql, /media_broadcast_audit_events/);
  assert.match(sql, /factsport_v2_media_broadcast_admin/);
  assert.match(sql, /factsport_v2_broadcast_token_issuer/);
  assert.doesNotMatch(sql, /^GRANT .*factsport_v2_editorial_writer/im);
  assert.doesNotMatch(sql, /^GRANT .*factsport_v2_social_dispatcher/im);
  assert.doesNotMatch(sql, /predictions|settlement|is_vip/i);
});
