const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('community chat inserts enforce match closure, reply scope and serialized per-user rate limits', () => {
  const sql = read('db/migrations/0045_factsport_media_community_write_integrity.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.enforce_media_chat_message_integrity\(\)/);
  assert.match(sql, /BEFORE INSERT ON public\.media_match_chat_messages/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /NEW\.created_at := clock_timestamp\(\)/);
  assert.match(sql, /FROM public\.matches WHERE id = NEW\.match_id FOR SHARE/);
  assert.match(sql, /chat_closed/);
  assert.match(sql, /NEW\.created_at > kick_time \+ interval '4 hours'/);
  assert.match(sql, /parent_match IS DISTINCT FROM NEW\.match_id/);
  assert.match(sql, /hidden_at IS NULL/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(NEW\.author_user_id::text, 1045\)\)/);
  assert.match(sql, /last_post \+ interval '3 seconds'/);
  assert.match(sql, /chat_links_or_reserved_markup_not_allowed/);
});

test('MOTM inserts require verified recorded starting lineups and 24-hour voting window', () => {
  const sql = read('db/migrations/0045_factsport_media_community_write_integrity.sql');
  const original = read('docs/audit/legacy-source/external-fast-espn-motm-d1-worker-v1.js.txt');
  const schema = read('db/migrations/0044_factsport_media_community_chat_motm.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.enforce_media_motm_vote_integrity\(\)/);
  assert.match(sql, /BEFORE INSERT ON public\.media_match_motm_votes/);
  assert.match(sql, /NEW\.created_at < kick_time OR NEW\.created_at > kick_time \+ interval '24 hours'/);
  assert.match(sql, /jsonb_array_elements\(home_roster \|\| away_roster\)/);
  assert.match(sql, /player\.item ->> 'name' = NEW\.player_name/);
  assert.match(sql, /player\.item ->> 'is_starter' = 'true'/);
  assert.match(sql, /motm_player_not_in_verified_starting_lineup/);
  assert.match(schema, /UNIQUE \(match_id, voter_user_id\)/);
  assert.match(original, /is_starter: p\.starter \|\| false/);
});

test('M45 installs no public community write privileges or active D1 bindings', () => {
  const sql = read('db/migrations/0045_factsport_media_community_write_integrity.sql');
  const chat = read('app/api/media/chat/messages/route.ts');
  const motm = read('app/api/media/motm/route.ts');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.enforce_media_chat_message_integrity/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.enforce_media_motm_vote_integrity/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE|EXECUTE) ON/);
  assert.doesNotMatch(sql, /env\.DB|D1Database|d1_databases/);
  for (const route of [chat, motm]) {
    assert.match(route, /export async function POST/);
    assert.match(route, /status: 503/);
  }
});

test('legacy chat and MOTM clients do not silently acknowledge failed posts or accept client identity', () => {
  const chat = read('app/components/FanZoneChat.tsx');
  const motm = read('app/components/MOTMVoteWidget.tsx');
  assert.match(chat, /if \(!response\.ok\) throw new Error\('Message was not accepted\.'/);
  assert.match(chat, /prev\.filter\(message => message\.id !== tempMsg\.id\)/);
  assert.match(chat, /setSubmissionError\('Your message was not posted/);
  assert.match(chat, /body: JSON\.stringify\(\{ match_id: matchId, message: tempMsg\.message, reply_to_id: replyTo\?\.id \|\| null \}\)/);
  const start = chat.indexOf('const response = await fetch(');
  const end = chat.indexOf('if (!response.ok)', start);
  const send = chat.slice(start, end);
  assert.doesNotMatch(send, /user_id:|username:|avatar_url:/);
  assert.match(chat, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(motm, /if \(!response\.ok\) throw new Error\('MOTM vote was not accepted\.'/);
  assert.match(motm, /setVoteError\('Your vote was not recorded/);
  assert.match(motm, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
});
