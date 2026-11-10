const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('legacy-compatible player only identifies verified YouTube hosts and IDs', () => {
  const player = read('app/components/FactSportPlayer.tsx');
  assert.match(player, /const youtubeVideoId = \(\(\) =>/);
  assert.match(player, /url\.hostname\.toLowerCase\(\)/);
  assert.match(player, /host === 'youtu\.be'/);
  assert.match(player, /\['youtube\.com', 'www\.youtube\.com'/);
  assert.match(player, /\^\[A-Za-z0-9_-\]\{11\}\$/);
  assert.match(player, /const isYouTube = youtubeVideoId !== null/);
  assert.doesNotMatch(player, /mediaUrl\.includes\('youtube\.com'\)/);
  assert.doesNotMatch(player, /mediaUrl\.includes\('embed\/'\)/);
  assert.match(player, /https:\/\/www\.youtube\.com\/embed\/\$\{youtubeVideoId\}/);
  assert.match(player, /mediaUrl === 'streamio'/);
  assert.match(player, /const isRawMedia/);
  assert.match(player, /const isRawAudio/);
  assert.equal((player.match(/postMessage\\(JSON\\.stringify\\(/g) || []).length, 3);
  assert.match(player, /postMessage\\(JSON\\.stringify\\(\\{ event: 'command', func: 'playVideo' \\}\\), 'https:\\/\\/www\\.youtube\\.com'\\)/);
  assert.doesNotMatch(player, /postMessage\\(JSON\\.stringify\\([^\\n]+, '\\*'\\)/);
});

test('broadcast settings reject unsafe local/private media destinations', () => {
  const actions = read('app/admin/studio/actions.ts');
  assert.match(actions, /function safeMediaUrl/);
  assert.match(actions, /trimmed === 'streamio'/);
  assert.match(actions, /host === 'localhost'/);
  assert.match(actions, /host\.endsWith\('\.internal'\)/);
  assert.match(actions, /host\.startsWith\('fe80:'\)/);
  assert.match(actions, /192/);
  assert.match(actions, /Broadcast media URLs cannot target local or private networks/);
  assert.match(actions, /authorizeMediaEditorialAction\('broadcast'\)/);
});
