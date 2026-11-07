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
  ];
  for (const file of publicFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /AdsterraStandardBanner|BettingPromo|FreeTipsBanner|affiliateLink|refpa\d+\.com|Melbet|1xBet|Predict & Win|VIP Upgrade/i, file);
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
