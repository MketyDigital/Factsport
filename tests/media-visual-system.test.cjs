const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('visual stat parser preserves unknown sports values instead of fabricating zeros', () => {
  const source = read('app/components/VisualStatCompare.tsx');
  const start = source.indexOf('export function parseVisualStat(');
  const end = source.indexOf('export default function VisualStatCompare(', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end)
    .replace('export function parseVisualStat(value: Value): number | null {', 'function parseVisualStat(value) {');
  const parse = vm.runInNewContext(helper + '\nparseVisualStat', { Number, String }, { timeout: 1000 });
  for (const value of [null, undefined, '', 'unknown', 'N/A', '-1', '—', '50 apples', {}, NaN]) {
    assert.equal(parse(value), null, String(value));
  }
  assert.equal(parse('55%'), 55);
  assert.equal(parse('45.5%'), 45.5);
  assert.equal(parse('0'), 0);
  assert.equal(parse(12), 12);
  assert.match(source, /aria-label=\{hasBoth \?/);
  assert.match(source, /hasBoth && total > 0/);
  assert.match(source, /fs-visual-panel/);
});

test('match Stats tab uses rich comparisons and preserves missing ESPN data', () => {
  const stats = read('app/components/StatsLineupsTabs.tsx');
  assert.match(stats, /VisualStatCompare/);
  assert.match(stats, /homeTeam=\{homeTeam\} awayTeam=\{awayTeam\}/);
  assert.match(stats, /stats\?\.home\?\.possession\}/);
  assert.match(stats, /getSafeShots\(stats\?\.home\)/);
  assert.match(stats, /col-span-full.*MatchTimeline/);
  assert.match(stats, /<PitchLineup/);
  assert.match(stats, /PlayerRatingsWidget/);
  assert.doesNotMatch(stats, /possession \|\| '50%'/);
  assert.doesNotMatch(stats, /function StatRow/);
  assert.match(stats, /\/\^\\d\+\$\//);
});

test('homepage and match listings use light depth, canonical fast source and stale protection', () => {
  const hero = read('app/components/HeroMatchCards.tsx');
  const match = read('app/components/CompactMatchRow.tsx');
  const css = read('app/globals.css');
  assert.match(hero, /fs-visual-card-interactive/);
  assert.match(hero, /fs-visual-card p-3/);
  assert.match(match, /fs-visual-panel fs-visual-card-interactive/);
  for (const source of [hero, match]) {
    assert.match(source, /data\.stale !== true/);
    assert.match(source, /fetchLiveMatchDeduplicated\(m(?:atch)?\.espn_id, m(?:atch)?\.id\)/);
  }
  assert.match(css, /\.fs-visual-panel/);
  assert.match(css, /\.fs-visual-card/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /@keyframes.*infinite/);
});

test('standings preserve semantic table while adding rank, point and form visuals', () => {
  const page = read('app/standings/page.tsx');
  assert.match(page, /<table className=/);
  assert.match(page, /fs-standings-rank/);
  assert.match(page, /aria-label=\{\`Position/);
  assert.match(page, /\{entry\.position\}<\/span>/);
  assert.match(page, /rounded-lg bg-slate-900.*\{entry\.points\}/);
  assert.match(page, /aria-label=\{result === 'W'/);
  assert.match(page, /hasFormData/);
});

test('standings shares reuse existing 1200x630 OG renderer with controlled league metadata', () => {
  const page = read('app/standings/page.tsx');
  const og = read('app/api/og/route.tsx');
  assert.match(page, /Object\.prototype\.hasOwnProperty\.call\(LEAGUE_MAP, requestedLeague\)/);
  assert.match(page, /type: 'standings', league/);
  assert.match(page, /\/api\/og\?data=/);
  assert.match(page, /openGraph:/);
  assert.match(page, /images: \[\{ url: ogImage, width: 1200, height: 630/);
  assert.match(page, /twitter:[\s\S]*images: \[ogImage\]/);
  assert.match(og, /parsedData\.type === 'standings'/);
  assert.match(og, /THE RACE FOR THE TOP/);
  assert.match(og, /TABLE · POINTS · RECENT FORM/);
  assert.match(og, /\{ width: 1200, height: 630 \}/);
  assert.match(og, /parsedData\.type === 'versus'/);
  assert.match(og, /parsedData\.type === 'pitch'/);
});


test('existing 2D pitch gains gentle depth without losing starters or substitutes', () => {
  const pitch = read('app/components/PitchLineup.tsx');
  assert.match(pitch, /starting eleven pitch/);
  assert.match(pitch, /fs-visual-card-interactive/);
  assert.match(pitch, /bench\.map/);
  assert.match(pitch, /starters = lineups\[activeTab\]\.filter/);
  assert.match(pitch, /formationArray/);
  assert.match(pitch, /role="group"/);
  assert.doesNotMatch(pitch, /cursor-pointer animate-in zoom-in/);
});
