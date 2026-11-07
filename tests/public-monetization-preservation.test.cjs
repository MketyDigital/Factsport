const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const expectedPlacements = {
  'app/news/page.tsx': { banners: 3, bettingPromos: 1 },
  'app/news/[slug]/page.tsx': { banners: 3, bettingPromos: 1 },
  'app/highlights/page.tsx': { banners: 2, bettingPromos: 0 },
  'app/standings/page.tsx': { banners: 1, bettingPromos: 0 },
  'app/tournaments/page.tsx': { banners: 1, bettingPromos: 0 },
  'app/tournaments/[league]/page.tsx': { banners: 1, bettingPromos: 0 },
  'app/leaderboard/page.tsx': { banners: 2, bettingPromos: 0 },
  'app/live/page.tsx': { banners: 1, bettingPromos: 0 },
};

test('existing public monetization placements are preserved until an approved policy decision', () => {
  for (const [file, expected] of Object.entries(expectedPlacements)) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const banners = (source.match(/<AdsterraStandardBanner\s*\/>/g) || []).length;
    const bettingPromos = (source.match(/<BettingPromo\b/g) || []).length;
    assert.equal(banners, expected.banners, file + ' Adsterra placements');
    assert.equal(bettingPromos, expected.bettingPromos, file + ' betting promo placements');
  }
});
