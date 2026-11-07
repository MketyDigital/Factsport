const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const home = read('app/page.tsx');
const dashboard = read('app/components/HomeDashboardClient.tsx');
const standings = read('app/components/MiniStandings.tsx');
const settingsRoute = read('app/api/settings/route.ts');
const highlights = read('app/components/HighlightsSlider.tsx');
const homepageAdapter = read('lib/adapters/postgres-homepage.ts');
const dbClient = read('lib/adapters/postgres-client.ts');
const matchesAdapter = read('lib/adapters/postgres-matches.ts');
const editorialAdapter = read('lib/adapters/postgres-editorial.ts');

test('homepage uses PostgreSQL views for featured matches and rights-cleared highlights', () => {
  assert.match(home, /FACTSPORT_MATCHES_BACKEND === 'postgres'/);
  assert.match(home, /listPublicMatchHighlights\\(5\\)/);
  assert.match(home, /listPublicFeaturedMatches/);
  assert.match(home, /listPostgresMatchesWindow/);
  assert.match(home, /const getSupabase = \\(\\) =>/);
  assert.match(home, /image_url: row\\.hero_media_key/);
});

test('homepage settings are server-routed and do not expose the full social settings row', () => {
  assert.match(dashboard, /fetch\\('\\/api\\/settings'\\)/);
  assert.doesNotMatch(dashboard, /createClient|from\\('site_settings'\\)/);
  assert.match(settingsRoute, /getPublicHomepageSettings/);
  assert.match(settingsRoute, /featured_match_id/);
  assert.match(settingsRoute, /select\\('code_1xbet, code_melbet, link_1xbet, link_melbet, featured_match_id:social_config->>featured_match_id'\\)/);
  assert.doesNotMatch(settingsRoute, /select\\('\\*'\\)/);
});

test('mini standings has a PostgreSQL season-aware read path', () => {
  assert.match(standings, /listCurrentCompetitionStandings/);
  assert.match(standings, /FACTSPORT_MATCHES_BACKEND === 'postgres'/);
});

test('highlight cards use public R2 thumbnails and stable highlight identifiers', () => {
  assert.match(highlights, /item\\.thumbnail_url/);
  assert.match(highlights, /item\\.highlight_id \\|\\| item\\.id/);
  assert.match(homepageAdapter, /FROM public\\.public_match_highlights/i);
  assert.match(homepageAdapter, /FROM public\\.public_featured_matches/i);
  assert.match(homepageAdapter, /FROM public\\.public_competition_standings/i);
  assert.match(homepageAdapter, /FROM public\\.public_homepage_settings/i);
});

test('domain adapters share one bounded Hyperdrive client per Worker isolate', () => {
  assert.match(dbClient, /max: 1/);
  assert.match(dbClient, /FACTSPORT_HYPERDRIVE/);
  assert.match(matchesAdapter, /getFactsportPostgres/);
  assert.match(editorialAdapter, /getFactsportPostgres/);
  assert.match(homepageAdapter, /getFactsportPostgres/);
  assert.doesNotMatch(matchesAdapter, /let client: ReturnType<typeof postgres>/);
  assert.doesNotMatch(editorialAdapter, /let client: ReturnType<typeof postgres>/);
});
