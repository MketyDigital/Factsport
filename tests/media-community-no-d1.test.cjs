const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

test('original owner-uploaded external Worker bodies are archived byte-for-byte', () => {
  const sources = [
    ['docs/audit/legacy-source/external-chat-d1-worker-v1.js.txt',
      'fe34202411f24eb4acaa18eed8875ea5849fefdf09a537de80e769ea647b70d1'],
    ['docs/audit/legacy-source/external-fast-espn-motm-d1-worker-v1.js.txt',
      '591825b4bf374703d0e32580e55eb2c6d19dac9f0238f3689f7037744dbb9c53'],
  ];
  for (const [filename, expected] of sources) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filename))).digest('hex'), expected);
    assert.match(read(filename), /env\.DB\.prepare/);
    assert.match(read(filename), /caches\.default/);
  }
});

test('chat and MOTM clients do not call the legacy D1-backed hostnames', () => {
  const chat = read('app/components/FanZoneChat.tsx');
  const motm = read('app/components/MOTMVoteWidget.tsx');
  assert.doesNotMatch(chat, /chat-api\.factsport\.com|env\.DB/);
  assert.doesNotMatch(motm, /live-api\.factsport\.com\/api\/motm|env\.DB/);
  assert.match(chat, /const CHAT_WORKER_URL = '\/api\/media\/chat'/);
  assert.match(motm, /const WORKER_URL = '\/api\/media\/motm'/);
  assert.match(chat, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(motm, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(chat, /Chat posting is paused/);
  assert.match(motm, /MOTM voting is being prepared for account-free visitors/);
});

test('public community readers use PostgreSQL and writes fail closed', () => {
  const adapter = read('lib/adapters/postgres-community.ts');
  assert.match(adapter, /withFactsportPostgres/);
  assert.match(adapter, /public\.public_media_match_chat_messages/);
  assert.match(adapter, /public\.public_media_match_motm_totals/);
  assert.match(adapter, /LIMIT 50/);
  assert.doesNotMatch(adapter, /env\.DB|D1Database|supabase/);
  for (const filename of [
    'app/api/media/chat/messages/route.ts',
    'app/api/media/motm/route.ts',
  ]) {
    const route = read(filename);
    assert.match(route, /FACTSPORT_MEDIA_COMMUNITY_BACKEND/);
    assert.match(route, /!== 'postgres'/);
    assert.match(route, /validCommunityMatchId/);
    assert.match(route, /export async function POST/);
    assert.match(route, /Media participation is not yet enabled/);
    assert.match(route, /env.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled'/);
    assert.doesNotMatch(route, /env\.DB|D1Database|supabase|service_role/);
  }
});

test('community schema isolates identity and votes using private PostgreSQL tables', () => {
  const migration = read('db/migrations/0044_factsport_media_community_chat_motm.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.media_match_chat_messages/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.media_match_motm_votes/);
  assert.match(migration, /UNIQUE \(match_id, voter_user_id\)/);
  assert.match(migration, /REFERENCES public\.app_users\(id\)/);
  assert.match(migration, /WHERE hidden_at IS NULL/);
  assert.match(migration, /GRANT SELECT ON public\.public_media_match_chat_messages/);
  assert.doesNotMatch(migration, /env\.DB|D1Database|d1_databases|GRANT INSERT ON public\.media_match/);
  const wranglers = fs.readdirSync(root).filter(filename => filename.startsWith('wrangler.') && filename.endsWith('.jsonc'));
  for (const wrangler of wranglers) {
    assert.doesNotMatch(read(wrangler), /"d1_databases"|"binding"\s*:\s*"DB"/);
  }
});
