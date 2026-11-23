const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const header = read('app/components/SiteHeader.tsx');
const layout = read('app/layout.tsx');
const home = read('app/page.tsx');

test('shared public header presents Media routes and keeps Prediction navigation separate', () => {
  for (const href of ['/', '/matches', '/live', '/standings', '/tournaments', '/news', '/highlights']) {
    assert.ok(header.includes(`href: '${href}'`), `expected public Media navigation route ${href}`);
  }
  assert.match(header, /aria-label="Media navigation"/);
  assert.match(header, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(header, /href: ['"]\/(login|register|dashboard|leaderboard|vip|how-to-play)/);
  assert.match(layout, /const application = isPrivateProductHost\s*\? children/);
});

test('private Prediction hostname gets its own root and does not query Media homepage data', () => {
  const privateBranch = home.indexOf('if (await isPrivateProductRequest()) return <PredictionEntryPage />;');
  const mediaRead = home.indexOf('getHomepageData(selectedLeague)');
  assert.ok(privateBranch >= 0, 'expected host-specific Prediction root');
  assert.ok(mediaRead > privateBranch, 'private root must return before Media homepage data is loaded');
  assert.match(home, /title: 'FactSport Predict \| Match Predictions'/);
  assert.match(home, /robots: \{ index: false, follow: false/);
  assert.match(home, /href="\/login"/);
  assert.match(home, /href="\/register"/);
  assert.doesNotMatch(home.slice(privateBranch, mediaRead), /href="\/(news|matches|live|standings|highlights)/);
});
