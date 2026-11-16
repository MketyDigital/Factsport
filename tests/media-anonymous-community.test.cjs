const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('anonymous Media identity is an HMAC-protected HttpOnly cookie, never an account', () => {
  const visitor = read('lib/media/anonymous-community-visitor.ts');
  assert.match(visitor, /__Host-factsport_media_visitor/);
  assert.match(visitor, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(visitor, /crypto\.subtle\.sign\('HMAC'/);
  assert.match(visitor, /crypto\.subtle\.verify\(/);
  assert.match(visitor, /FACTSPORT_MEDIA_VISITOR_SECRET/);
  assert.match(visitor, /HttpOnly; SameSite=Lax; Max-Age=/);
  assert.match(visitor, /; Secure/);
  assert.match(visitor, /Cross-origin community submission rejected/);
  assert.match(visitor, /content-type/);
  assert.match(visitor, /cf-connecting-ip/);
  assert.match(visitor, /FACTSPORT_MEDIA_NETWORK_PEPPER/);
  assert.match(visitor, /await sha256\('factsport-media-v1:' \+ nonce\)/);
  assert.match(visitor, /ensureAnonymousMediaSession/);
  assert.doesNotMatch(visitor, /D1Database|env\.DB|SUPABASE_SERVICE_ROLE_KEY|user_id.*request|email|password/);
});

test('PostgreSQL anonymous visitor identity is distinct from user and Prediction identity', () => {
  const migration = read('db/migrations/0046_factsport_anonymous_media_community.sql');
  assert.match(migration, /CREATE TABLE public\.media_visitor_participants/);
  assert.match(migration, /token_hash char\(64\) NOT NULL UNIQUE/);
  assert.match(migration, /ALTER COLUMN author_user_id DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN voter_user_id DROP NOT NULL/);
  assert.match(migration, /CHECK \(\(author_user_id IS NULL\) <> \(visitor_id IS NULL\)\)/);
  assert.match(migration, /CHECK \(\(voter_user_id IS NULL\) <> \(visitor_id IS NULL\)\)/);
  assert.match(migration, /CREATE UNIQUE INDEX media_motm_visitor_once_idx/);
  assert.match(migration, /ON public\.media_match_motm_votes \(match_id, visitor_id\)/);
  assert.match(migration, /visitor_id uuid REFERENCES public\.media_visitor_participants/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /media_community_network_limits/);
  assert.match(migration, /community_network_rate_limited/);
  assert.match(migration, /suspended_at IS NOT NULL/);
  assert.match(migration, /legacy_match_id = p_match_id/);
  assert.match(migration, /p_reply_to uuid DEFAULT NULL/);
  assert.match(migration, /reply_to_id/);
  assert.match(migration, /WHERE hidden_at IS NULL/);
  assert.doesNotMatch(migration, /D1Database|env\.DB|supabase\.auth|prediction_participants/);
});

test('dedicated PostgreSQL community capability never inherits private database tables', () => {
  const role = read('db/migrations/0047_factsport_anonymous_media_community_role.sql');
  const client = read('lib/adapters/postgres-client.ts');
  const types = read('types/factsport-cloudflare-workers.d.ts');
  assert.match(role, /CREATE ROLE factsport_v2_community_api NOLOGIN/);
  assert.match(role, /REVOKE ALL ON public\.media_visitor_participants/);
  assert.match(role, /GRANT EXECUTE ON FUNCTION public\.submit_anonymous_media_chat/);
  assert.match(role, /GRANT EXECUTE ON FUNCTION public\.submit_anonymous_media_motm/);
  assert.match(role, /get_anonymous_media_vote_state/);
  assert.doesNotMatch(role, /GRANT SELECT ON public\.media_match_motm_votes|GRANT INSERT ON public\.media_match_chat_messages/);
  assert.match(client, /FACTSPORT_COMMUNITY_HYPERDRIVE\?\.connectionString/);
  assert.match(types, /FACTSPORT_COMMUNITY_HYPERDRIVE/);
  assert.match(types, /FACTSPORT_MEDIA_VISITOR_SECRET/);
  assert.match(types, /FACTSPORT_MEDIA_NETWORK_PEPPER/);
  assert.match(types, /FACTSPORT_MEDIA_COMMUNITY_WRITES/);
});

test('guest APIs require backend and write flags, same-origin verification and bounded bodies', () => {
  for (const p of [
    'app/api/media/chat/messages/route.ts',
    'app/api/media/motm/route.ts',
  ]) {
    const route = read(p);
    assert.match(route, /env\.FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled'/);
    assert.match(route, /FACTSPORT_MEDIA_COMMUNITY_BACKEND/);
    assert.match(route, /anonymousCommunityVisitor\(request\)/);
    assert.match(route, /withFactsportCommunityPostgres/);
    assert.match(route, /Unexpected submission fields/);
    assert.match(route, /Submission too large/);
    assert.match(route, /visitor\.tokenHash/);
    assert.match(route, /visitor\.networkHash/);
    assert.match(route, /Set-Cookie/);
    assert.match(route, /status === 429/);
    assert.doesNotMatch(route, /env\.DB|D1Database|user_id: body|voter_user_id: body|supabase/);
  }
  const chat = read('app/api/media/chat/messages/route.ts');
  assert.match(chat, /reply_to_id/);
  assert.match(chat, /validCommunityMatchId\(replyId\)/);
  const motmState = read('app/api/media/motm/state/route.ts');
  assert.match(motmState, /ensureAnonymousMediaSession\(request\)/);
  assert.match(motmState, /get_anonymous_media_vote_state/);
  assert.match(motmState, /private, no-store/);
});

test('Media chat and MOTM allow visitors without an account and never trust localStorage as vote identity', () => {
  const chat = read('app/components/FanZoneChat.tsx');
  const motm = read('app/components/MOTMVoteWidget.tsx');
  assert.doesNotMatch(chat, /useAuth\(|supabase\/client|createClient\(|Login to chat|user\.id|chat-api\.factsport\.com/);
  assert.match(chat, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(chat, /Join the chat without an account/);
  assert.match(chat, /reply_to_id: replyTo\?\.id/);
  assert.match(chat, /msg\.reply_to_id/);
  assert.match(motm, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(motm, /\/api\/media\/motm\/state\?matchId=/);
  assert.match(motm, /voteStateReady/);
  assert.doesNotMatch(motm, /localStorage|useAuth\(|supabase\/client|D1Database/);
});
