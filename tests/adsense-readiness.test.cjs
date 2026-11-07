const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const policy = read('lib/adsense-policy.ts');

test('AdSense gate is opt-in, approved, consent-ready and exact public domain only', () => {
  assert.match(policy, /!gate\.enabled \|\| !gate\.approved \|\| !gate\.consentReady/);
  assert.match(policy, /factsport\.com/);
  assert.match(policy, /pub-\[0-9\]\{16\}/);
  assert.doesNotMatch(read('app/layout.tsx'), /pagead2\.googlesyndication\.com|adsbygoogle/);
});

test('only editorial pages can be eligible; interaction and private surfaces are excluded', () => {
  assert.match(policy, /PUBLIC_EDITORIAL_PATHS/);
  assert.match(policy, /match\|matches\|live\|leaderboard\|embed/);
  assert.match(policy, /admin\|api\|dashboard\|account\|login\|register\|auth\|vip\|predict\|payment\|checkout\|chat\|studio\|settings/);
});

test('public pages do not render betting affiliate widgets or promote private VIP', () => {
  const publicFiles = [
    'app/page.tsx', 'app/news/page.tsx', 'app/news/[slug]/page.tsx',
    'app/live/page.tsx', 'app/match/[id]/page.tsx',
    'app/highlights/page.tsx', 'app/standings/page.tsx', 'app/tournaments/page.tsx', 'app/tournaments/[league]/page.tsx',
    'app/components/Footer.tsx', 'app/components/SiteHeader.tsx',
    'app/components/HomeDashboardClient.tsx', 'app/components/MatchMobileHub.tsx',
  ];
  for (const file of publicFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /AdsterraStandardBanner|BettingPromo|FreeTipsBanner|BetOfTheDay|ProBettingSlipLock|affiliateLink|refpa\d+\.com|Melbet|1xBet|Predict & Win|VIP Upgrade/i, file);
  }
});

test('Prediction affiliate settings are not exposed by public Media settings endpoint', () => {
  const mediaApi = read('app/api/settings/route.ts');
  const predictionApi = read('app/api/prediction/settings/route.ts');
  assert.doesNotMatch(mediaApi, /getPublicPredictionAffiliateSettings|link_1xbet|link_melbet|code_1xbet|code_melbet/);
  assert.match(predictionApi, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(predictionApi, /getPublicPredictionAffiliateSettings/);
});

test('VIP and prize campaign surfaces are private-host gated and noindex', () => {
  const vipLayout = read('app/vip/upgrade/layout.tsx');
  const howToPlay = read('app/how-to-play/page.tsx');
  const leaderboardLayout = read('app/leaderboard/layout.tsx');
  assert.match(vipLayout, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(vipLayout, /notFound\(\)/);
  assert.match(howToPlay, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(howToPlay, /index: false/);
  assert.match(leaderboardLayout, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(leaderboardLayout, /index: false/);
});

test('public social publishing requires public-only channel scope and explicit compliance confirmation', () => {
  const migration = read('db/migrations/0022_factsport_public_media_social_scope.sql');
  const action = read('app/admin/social/actions.ts');
  const client = read('app/admin/social/SocialClient.tsx');
  assert.match(migration, /surface_scope = 'public_media'/);
  assert.match(migration, /public_content_confirmed_by/);
  assert.match(action, /surface_scope='public_media'/);
  assert.match(action, /publicContentConfirmed !== true/);
  assert.match(action, /inspectPublicMediaArticle/);
  assert.match(client, /no bookmaker or betting-affiliate promotion/);
});

test('public SEO stays disabled until the V2 PostgreSQL content and sitemap are ready', () => {
  const robots = read('app/robots.ts');
  const sitemap = read('app/sitemap.ts');
  assert.match(robots, /FACTSPORT_INDEXING_ENABLED === 'true'/);
  assert.match(robots, /FACTSPORT_SITEMAP_BACKEND === 'postgres'/);
  assert.match(sitemap, /FACTSPORT_SITEMAP_BACKEND === 'postgres'/);
  assert.doesNotMatch(sitemap, /@supabase\/supabase-js|createClient/);
});

test('public CMS publication enforces content policy and records publisher attestation', () => {
  const policy = read('lib/public-media-content-policy.ts');
  const actions = read('app/admin/news/actions.ts');
  const client = read('app/admin/news/NewsroomClient.tsx');
  const migration = read('db/migrations/0023_factsport_public_editorial_policy_attestation.sql');
  assert.match(policy, /BOOKMAKER_LINK_HOST/);
  assert.match(policy, /PROMOTIONAL_COPY/);
  assert.match(policy, /PRIVATE_PRODUCT_PROMOTION/);
  assert.match(actions, /inspectPublicMediaArticle\(snapshot\)/);
  assert.match(actions, /publicContentConfirmed !== true/);
  assert.match(actions, /public_media_policy_confirmed_by/);
  assert.match(client, /no bookmaker\/affiliate links, betting promotions/);
  assert.match(migration, /public_media_policy_confirmed_at/);
});

test('public Media pages use V2 read adapters in production and never fall back to legacy SELECT *', () => {
  const homepage = read('app/page.tsx');
  const match = read('app/match/[id]/page.tsx');
  const live = read('app/live/page.tsx');
  const matches = read('app/matches/page.tsx');
  const news = read('app/news/page.tsx');
  const standings = read('app/standings/page.tsx');
  assert.match(homepage, /usePostgresEditorial && usePostgresMatches && usePostgresHomepage/);
  assert.match(match, /getPostgresMatchById/);
  assert.match(match, /getPostgresMatchPlaybackById/);
  assert.match(match, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(live, /listPostgresMatchesWindow/);
  assert.match(live, /getPublicMediaStudioSettings/);
  assert.match(matches, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(news, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(standings, /else if \(process\.env\.NODE_ENV === 'development'\)/);
});

test('social embed uses secure playback without timed redirects or forced Telegram popups', () => {
  const page = read('app/embed/[id]/page.tsx');
  const client = read('app/components/EmbedPlayerClient.tsx');
  const robots = read('app/robots.ts');
  assert.match(page, /getPostgresMatchById/);
  assert.match(page, /getPostgresMatchPlaybackById/);
  assert.match(client, /SecureMatchPlayer/);
  assert.doesNotMatch(client, /setInterval|window\.location\.href|timeLeft|showPopup|telegramSupport/);
  assert.doesNotMatch(robots, /'\/embed'/);
  assert.match(page, /index: false/);
});

test('legacy free PredictionBoard cannot read or write Supabase from production Media match pages', () => {
  const match = read('app/match/[id]/page.tsx');
  const predictionMigration = read('db/migrations/0003_factsport_public_predictions.sql');
  assert.match(match, /process\.env\.NODE_ENV === 'development' && <PredictionBoard/);
  assert.match(predictionMigration, /CREATE TABLE IF NOT EXISTS public\.predictions/);
  assert.match(predictionMigration, /is_eligible_for_prize boolean NOT NULL DEFAULT false/);
});

test('registered Prediction account and authentication routes are private-host only', () => {
  const rootLayout = read('app/layout.tsx');
  const header = read('app/components/SiteHeader.tsx');
  const callback = read('app/auth/callback/route.ts');
  assert.match(rootLayout, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
  assert.match(rootLayout, /const application = isPrivateProductHost[\s\S]*\? children/);
  assert.match(rootLayout, /NODE_ENV === 'development'\s*\?\s*<AuthProvider>/);
  assert.doesNotMatch(header, /useAuth|\/login|\/dashboard|Account/);
  for (const file of [
    'app/dashboard/layout.tsx', 'app/login/layout.tsx', 'app/register/layout.tsx',
    'app/forgot-password/layout.tsx', 'app/auth/update-password/layout.tsx',
  ]) assert.match(read(file), /requirePrivateProductHost/);
  assert.match(callback, /requestUrl\.hostname\.toLowerCase\(\) !== privateHost/);
});

test('private Prediction deployment cannot publish the Media robots or sitemap', () => {
  const robots = read('app/robots.ts');
  const sitemap = read('app/sitemap.ts');
  assert.match(robots, /requestHost === privateHost/);
  assert.match(robots, /disallow: '\/'/);
  assert.match(sitemap, /requestHost === privateHost\) return \[\]/);
});

test('root layout has one valid document shell after public/private split', () => {
  const rootLayout = read('app/layout.tsx');
  assert.equal((rootLayout.match(/export default async function RootLayout/g) || []).length, 1);
  assert.equal((rootLayout.match(/<html lang="en">/g) || []).length, 1);
  assert.equal(rootLayout.split('</html>').length - 1, 1);
});

test('legacy user-generated chat is not exposed in production Media surfaces', () => {
  const match = read('app/match/[id]/page.tsx');
  const live = read('app/live/page.tsx');
  assert.match(match, /chatEnabled=\{process\.env\.NODE_ENV === 'development'\}/);
  assert.match(live, /process\.env\.NODE_ENV === 'development' \? <div/);
});

test('public Media homepage announcements have a separate screened editor and render path', () => {
  const action = read('app/admin/settings/actions.ts');
  const page = read('app/admin/settings/page.tsx');
  const client = read('app/admin/settings/MediaSettingsClient.tsx');
  const migration = read('db/migrations/0025_factsport_media_homepage_settings_grants.sql');
  const publicBar = read('app/components/PublicMediaAnnouncement.tsx');
  const layout = read('app/layout.tsx');
  assert.match(action, /authorizeMediaEditorialAction\('publish'\)/);
  assert.match(action, /inspectPublicMediaArticle/);
  assert.match(action, /ON CONFLICT \(singleton\) DO UPDATE/);
  assert.match(page, /withFactsportEditorialPostgres/);
  assert.match(client, /Prediction affiliate links, promo codes/);
  assert.match(migration, /factsport_v2_editorial_writer/);
  assert.match(publicBar, /announcement_enabled/);
  assert.match(layout, /PublicMediaAnnouncement/);
});

test('public legal copy describes Media only and does not advertise Prediction or gambling features', () => {
  const footer = read('app/components/Footer.tsx');
  const privacy = read('app/privacy-policy/page.tsx');
  const terms = read('app/terms/page.tsx');
  const disclaimer = read('app/disclaimer/page.tsx');
  assert.doesNotMatch(footer, /Gamble Responsibly|18\+/i);
  assert.match(privacy, /separately operated Prediction product has its own privacy notice/);
  assert.match(terms, /Prediction entries, premium memberships, payment services and prize campaigns are not part of this public Media service/);
  assert.match(disclaimer, /Prediction entries, wagering and prize campaigns are not features of the public Media website/);
});
