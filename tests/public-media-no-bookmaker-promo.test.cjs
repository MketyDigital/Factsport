const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicPages = [
  'app/news/page.tsx',
  'app/news/[slug]/page.tsx',
  'app/highlights/page.tsx',
  'app/standings/page.tsx',
  'app/match/[id]/page.tsx',
  'app/tournaments/page.tsx',
  'app/tournaments/[league]/page.tsx',
  'app/leaderboard/page.tsx',
  'app/live/page.tsx',
];

test('public media and sports routes do not render bookmaker affiliate promotions', () => {
  for (const file of publicPages) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /<(?:AdsterraStandardBanner|BettingPromo)\\b|from ['\"][^'\"]*(?:AdsterraStandardBanner|BettingPromo)/i, file);
  }
});
