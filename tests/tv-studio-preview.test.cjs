const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Factsport TV preview is private, read-only and discoverable from Media operations', () => {
  const page = read('app/admin/tv/page.tsx');
  const layout = read('app/admin/layout.tsx');
  const home = read('app/admin/page.tsx');
  const preview = read('app/admin/tv/TVStoryboardPreview.tsx');
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(layout, /href="\/admin\/tv"/);
  assert.match(home, /href="\/admin\/tv"/);
  assert.match(preview, /Preview only · not publishable/);
  assert.match(preview, /disconnected from match feeds, rendering jobs and social accounts/);
  assert.doesNotMatch(preview, /fetch\(|use server|formAction=/);
});

test('TV preview uses distinct 2D/3D sample scenes and discloses illustrative material', () => {
  const preview = read('app/admin/tv/TVStoryboardPreview.tsx');
  const css = read('app/globals.css');
  assert.match(preview, /3D opening/);
  assert.match(preview, /2D lineups/);
  assert.match(preview, /Illustrative match scene/);
  assert.match(preview, /Not footage · not a real goal/);
  assert.match(preview, /Missing values stay unknown/);
  assert.match(preview, /aria-selected=/);
  assert.match(css, /\.fs-tv-field\s*\{\s*transform: perspective/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fs-tv-light, \.fs-tv-orbit, \.fs-tv-ball \{ animation: none/);
});
