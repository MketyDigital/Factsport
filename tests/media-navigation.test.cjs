const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const header = read('app/components/SiteHeader.tsx');
const layout = read('app/layout.tsx');

test('shared public header presents Media routes and keeps Prediction navigation separate', () => {
  for (const href of ['/', '/matches', '/live', '/standings', '/tournaments', '/news', '/highlights']) {
    assert.ok(header.includes(`href: '${href}'`), `expected public Media navigation route ${href}`);
  }
  assert.match(header, /aria-label="Media navigation"/);
  assert.match(header, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(header, /href: ['"]\/(login|register|dashboard|leaderboard|vip|how-to-play)/);
  assert.match(layout, /const application = isPrivateProductHost\s*\? children/);
});
