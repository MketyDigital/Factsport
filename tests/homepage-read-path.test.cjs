const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const home = read('app/page.tsx');
const highlightsPage = read('app/highlights/page.tsx');
const dashboard = read('app/components/HomeDashboardClient.tsx');
const standings = read('app/components/MiniStandings.tsx');
const settingsRoute = read('app/api/settings/route.ts');
const highlights = read('app/components/HighlightsSlider.tsx');
const homepageAdapter = read('lib/adapters/postgres-homepage.ts');
const dbClient = read('lib/adapters/postgres-client.ts');
const matchesAdapter = read('lib/adapters/postgres-matches.ts');
const editorialAdapter = read('lib/adapters/postgres-editorial.ts');

test('homepage uses PostgreSQL views for featured matches and rights-cleared highlights', () => {
  assert.ok(home.includes("FACTSPORT_HOMEPAGE_BACKEND === 'postgres'"));
  assert.ok(home.includes('listPublicMatchHighlights(5)'));
  assert.ok(home.includes('listPublicFeaturedMatches'));
  assert.ok(home.includes('listPostgresMatchesWindow'));
  assert.ok(home.includes('const getSupabase = () =>'));
  assert.ok(home.includes('image_url: row.hero_media_key'));
});

test('homepage settings are server-routed and do not expose the full social settings row', () => {
  assert.ok(dashboard.includes("fetch('/api/settings')"));
  assert.ok(!dashboard.includes('createClient'));
  assert.ok(!dashboard.includes("from('site_settings')"));
  assert.ok(settingsRoute.includes("mediaBackend === 'postgres'") && settingsRoute.includes('getPublicHomepageSettings'));
  assert.ok(!settingsRoute.includes('getPublicPredictionAffiliateSettings'));
  assert.ok(settingsRoute.includes('featured_match_id'));
  assert.ok(settingsRoute.includes('featured_match_id:social_config->>featured_match_id'));
  assert.ok(!settingsRoute.includes("select('*')"));
});

test('mini standings has a PostgreSQL season-aware read path', () => {
  assert.ok(standings.includes('listCurrentCompetitionStandings'));
  assert.ok(standings.includes("FACTSPORT_COMPETITIONS_BACKEND === 'postgres'"));
});

test('highlight cards use public R2 thumbnails and stable highlight identifiers', () => {
  assert.ok(highlights.includes('item.thumbnail_url'));
  assert.ok(highlights.includes('item.canonical_url || `/match/${item.id}`'));
  assert.ok(highlights.includes('noopener noreferrer'));
  assert.ok(highlights.includes('item.highlight_id || item.id'));
  assert.ok(homepageAdapter.includes('FROM public.public_match_highlights'));
  assert.ok(homepageAdapter.includes('FROM public.public_featured_matches'));
  assert.ok(homepageAdapter.includes('FROM public.public_competition_standings'));
  assert.ok(homepageAdapter.includes('FROM public.public_homepage_settings'));
});

test('domain adapters use request-scoped Hyperdrive clients and prepared static SQL', () => {
  assert.ok(dbClient.includes('withFactsportPostgres'));
  assert.ok(dbClient.includes('max: 1'));
  assert.ok(dbClient.includes('FACTSPORT_HYPERDRIVE'));
  assert.ok(dbClient.includes('await sql.end({ timeout: 1 })'));
  assert.ok(!dbClient.includes('let client: ReturnType<typeof postgres>'));
  for (const adapter of [matchesAdapter, editorialAdapter, homepageAdapter]) {
    assert.ok(adapter.includes('withFactsportPostgres'));
    assert.ok(!adapter.includes('getFactsportPostgres'));
    assert.ok(!adapter.includes('sql.unsafe('));
  }
  const baseWindow = matchesAdapter.slice(matchesAdapter.indexOf('export async function listPostgresMatchesWindow'), matchesAdapter.indexOf('export async function getPostgresTeamForm'));
  assert.ok(baseWindow.includes('FROM public.matches'));
  assert.ok(!baseWindow.includes('season'));
  assert.ok(matchesAdapter.includes('AND season ='));
  assert.ok(matchesAdapter.includes('::timestamptz'));
});

test('full highlights page supports PostgreSQL pagination and rights-cleared source links', () => {
  assert.ok(highlightsPage.includes("FACTSPORT_HIGHLIGHTS_BACKEND === 'postgres'"));
  assert.ok(highlightsPage.includes('listPublicHighlightLeagues'));
  assert.ok(highlightsPage.includes('countPublicMatchHighlights'));
  assert.ok(highlightsPage.includes('listPublicMatchHighlightsPage'));
  assert.ok(highlightsPage.includes('item.canonical_url ||'));
  assert.ok(highlightsPage.includes('item.thumbnail_url'));
  assert.ok(highlightsPage.includes('serializeJsonLd(jsonLd)'));
  assert.ok(homepageAdapter.includes('public_match_highlights'));
});
