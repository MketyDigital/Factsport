const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('player rating widget never uses legacy D1 endpoints, Supabase or localStorage authority', () => {
  const ui = read('app/components/PlayerRatingsWidget.tsx');
  const tabs = read('app/components/StatsLineupsTabs.tsx');
  assert.doesNotMatch(ui, /fse\.mkpoikankes\.workers\.dev|live-api\.factsport\.com|D1Database|env\.DB|localStorage|supabase/);
  assert.match(ui, /NEXT_PUBLIC_FACTSPORT_MEDIA_COMMUNITY_WRITES === 'enabled'/);
  assert.match(ui, /\/api\/media\/ratings\?matchId=/);
  assert.match(ui, /\/api\/media\/ratings\/state\?matchId=/);
  assert.match(ui, /verify|Turnstile/);
  assert.match(ui, /if \(!response\.ok\)/);
  assert.match(ui, /turnstile\.current\?\.reset\(\)/);
  assert.match(ui, /Account-free fan ratings will be available/);
  assert.match(ui, /canRate && ready && TURNSTILE_SITE_KEY/);
  assert.match(ui, /isFinished && Number\.isFinite\(hoursSinceKickoff\)/);
  assert.match(tabs, /matchDate=\{dbData\?\.match_date\}/);
});

test('PostgreSQL ratings are keyed by canonical match, verified visitor and actual starting player', () => {
  const sql = read('db/migrations/0048_factsport_media_guest_player_ratings.sql');
  assert.match(sql, /CREATE TABLE public\.media_match_player_ratings/);
  assert.match(sql, /UNIQUE\(match_id, visitor_id, player_name\)/);
  assert.match(sql, /rating BETWEEN 6 AND 10/);
  assert.match(sql, /legacy_match_id = p_match_id/);
  assert.match(sql, /status.*NOT IN/);
  assert.match(sql, /'24 hours'/);
  assert.match(sql, /jsonb_array_elements\(v_home \|\| v_away\)/);
  assert.match(sql, /is_starter' = 'true'/);
  assert.match(sql, /consume_media_community_network_limit/);
  assert.match(sql, /suspended_at IS NOT NULL/);
  assert.match(sql, /public_media_player_rating_totals/);
  assert.match(sql, /REVOKE ALL ON public\.media_match_player_ratings/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.submit_anonymous_media_player_rating/);
  assert.doesNotMatch(sql, /D1Database|env\.DB|prediction_participant|GRANT INSERT ON public\.media_match_player_ratings/);
});

test('same-origin ratings reads use PostgreSQL and writes use guest-only role and Turnstile', () => {
  const route = read('app/api/media/ratings/route.ts');
  const state = read('app/api/media/ratings/state/route.ts');
  const verify = read('lib/media/community-turnstile.ts');
  assert.match(route, /withFactsportPostgres/);
  assert.match(route, /withFactsportCommunityPostgres/);
  assert.match(route, /validCommunityMatchId/);
  assert.match(route, /anonymousCommunityVisitor\(request\)/);
  assert.match(route, /verifyMediaCommunityTurnstile\(request, body\.turnstileToken, 'media-rating'\)/);
  assert.match(route, /FACTSPORT_MEDIA_COMMUNITY_WRITES !== 'enabled'/);
  assert.match(route, /Unexpected fields/);
  assert.match(route, /status === 409/);
  assert.match(state, /ensureAnonymousMediaSession\(request\)/);
  assert.match(state, /get_anonymous_media_player_ratings/);
  assert.match(state, /private, no-store/);
  assert.match(verify, /'media-rating'/);
  assert.doesNotMatch(route+state, /D1Database|env\.DB|SUPABASE_SERVICE_ROLE_KEY|localStorage/);
});
