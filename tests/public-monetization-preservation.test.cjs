const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('AdSense-first public Media surfaces do not render betting affiliate widgets', () => {
  const publicFiles = [
    'app/page.tsx', 'app/news/page.tsx', 'app/news/[slug]/page.tsx',
    'app/live/page.tsx', 'app/match/[id]/page.tsx',
    'app/components/Footer.tsx', 'app/components/SiteHeader.tsx',
  ];
  for (const file of publicFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /AdsterraStandardBanner|BettingPromo|FreeTipsBanner|affiliateLink|refpa\d+\.com|Melbet|1xBet|Predict & Win|VIP Upgrade/i, file);
  }
});

test('legacy affiliate UI components remain in source only for private Prediction parity', () => {
  assert.match(read('app/components/BettingPromo.tsx'), /PROMO_CODE/);
  assert.match(read('app/components/FreeTipsBanner.tsx'), /link1x/);
  assert.match(read('app/components/AdsterraStandardBanner.tsx'), /AFFILIATE_LINK/);
  const privateApi = read('app/api/prediction/settings/route.ts');
  assert.match(privateApi, /FACTSPORT_PRIVATE_PRODUCT_HOST/);
});

test('public editorial surfaces do not contain unsolicited timed promotional popups', () => {
  const layout = read('app/layout.tsx');
  const header = read('app/components/SiteHeader.tsx');
  assert.doesNotMatch(layout, /CustomVignette/);
  assert.doesNotMatch(header, /CustomVignette/);
});
