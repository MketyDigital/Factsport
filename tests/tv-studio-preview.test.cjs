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
  const inventoryApi = read('app/api/admin/tv/episodes/route.ts');
  assert.match(page, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(layout, /href="\/admin\/tv"/);
  assert.match(home, /href="\/admin\/tv"/);
  assert.match(preview, /Preview only · not publishable/);
  assert.match(preview, /disconnected from real match feeds, durable render jobs and social accounts/);
  assert.match(preview, /renderMatchStorySvgScenes/);
  assert.match(preview, /Synthetic demo data · no real fixture, footage or player likeness/);
  assert.match(preview, /fetch\('\/api\/admin\/tv\/episodes'/);
  assert.match(preview, /cache: 'no-store'/);
  assert.match(inventoryApi, /authorizeMediaEditorialAction\('tv'\)/);
  assert.match(inventoryApi, /export async function GET\(/);
  assert.match(inventoryApi, /LIMIT 100/);
  assert.doesNotMatch(inventoryApi, /INSERT INTO|UPDATE public|DELETE FROM|upload/i);
  assert.doesNotMatch(preview, /use server|formAction=|youtube-resumable-upload|tiktok-draft-upload/);
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
  assert.match(preview, /Offline scene renderer output/);
  assert.match(css, /\.fs-tv-field\s*\{\s*transform: perspective/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fs-tv-light, \.fs-tv-orbit, \.fs-tv-ball \{ animation: none/);
});
