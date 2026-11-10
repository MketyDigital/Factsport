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
  assert.match(player, /const rawMediaPath/);
  assert.match(player, /return url\.pathname/);
  assert.match(player, /test\(rawMediaPath\)/);
  assert.match(player, /referrerPolicy="no-referrer"/);
  assert.match(player, /title="Factsport external match media"/);
  assert.match(player, /const isSafeMediaUrl/);
  assert.match(player, /value\.startsWith\('\/\/'\)/);
  assert.ok(player.includes('value.includes(String.fromCharCode(92))'));
  assert.ok(player.includes("url.username || url.password"));
  assert.ok(player.includes("host.startsWith('169.254.')"));
  assert.match(player, /host\.endsWith\('\.internal'\)/);
  assert.match(player, /private172/);
  assert.ok(player.includes("if (!mediaUrl || !isSafeMediaUrl) return <DefaultPreview />;"));
  assert.ok(player.includes("if (isTimeLocked || !isSafeMediaUrl || !mediaUrl"));
  assert.equal(player.split("postMessage(JSON.stringify(").length - 1, 3);
  assert.ok(player.includes("postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), 'https://www.youtube.com')"));
  assert.ok(!player.includes("}), '*')"), 'YouTube commands must not use wildcard target origins');
});


test('signed external HLS uses native video or already-installed hls.js, not an iframe', () => {
  const player = read('app/components/FactSportPlayer.tsx');
  const dependencies = JSON.parse(read('package.json')).dependencies;
  assert.equal(dependencies['hls.js'], '^1.5.8');
  assert.match(player, /const isHls =/);
  assert.ok(player.includes("video.canPlayType('application/vnd.apple.mpegurl')"));
  assert.ok(player.includes("void import('hls.js')"));
  assert.ok(player.includes('Hls.isSupported()'));
  assert.ok(player.includes('hls.loadSource(mediaUrl)'));
  assert.ok(player.includes('hls.attachMedia(video)'));
  assert.ok(player.includes('cleanup = () => hls.destroy()'));
  assert.ok(player.includes('src={isHls ? undefined : mediaUrl}'));
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
