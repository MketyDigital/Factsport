const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const page = read('app/match/[id]/page.tsx');
const player = read('app/components/SecureMatchPlayer.tsx');
const playback = read('app/api/match/[id]/playback/route.ts');
const analysis = read('app/api/match/[id]/analysis/route.ts');
const proCard = read('app/components/ProBettingSlipLock.tsx');
const mobileHub = read('app/components/MatchMobileHub.tsx');

test('match page does not serialize raw stream or VIP analysis data into client props', () => {
  assert.match(page, /const clientMatchData = \{/);
  assert.match(page, /MatchHeaderClient dbData=\{clientMatchData\}/);
  assert.match(page, /MatchMobileHub matchId=\{dbData\.id\} espnId=\{dbData\.espn_id\} dbData=\{clientMatchData\}/);
  assert.doesNotMatch(page, /mediaUrl=\{activeVideoUrl\}|mediaUrl=\{activeAudioUrl\}/);
  assert.doesNotMatch(page, /pro_analysis|campaign_id/);
  assert.match(page, /mediaUnlocked = isFinished \|\| isLive/);
  assert.match(page, /announcement_text, announcement_link, announcement_enabled/);
});

test('playback endpoint withholds media URLs until the server-side 15-minute unlock', () => {
  assert.match(playback, /select\('match_date, status, video_url, livestream_url, audio_url'\)/);
  assert.match(playback, /Date\.now\(\) < unlockAt/);
  const lockedBranch = playback.slice(playback.indexOf("status: 'locked'"), playback.indexOf('const videoSource'));
  assert.doesNotMatch(lockedBranch, /mediaUrl\s*:|videoUrl\s*:|audioUrl\s*:/);
  assert.match(playback, /safePlaybackUrl/);
  assert.match(playback, /audioUrl: videoUrl \? audioUrl : null/);
  assert.match(player, /audioUrl=\{playback\.audioUrl\}/);
  assert.match(playback, /\['https:', 'http:'\]/);
  assert.match(player, /\/api\/match\/.*\/playback/);
  assert.match(player, /state === 'ready' && playback\?\.mediaUrl/);
});

test('VIP analysis is only returned after server-side session and profile verification', () => {
  assert.match(analysis, /supabase\.auth\.getUser\(\)/);
  assert.match(analysis, /from\('profiles'\)/);
  assert.match(analysis, /select\('is_vip'\)/);
  assert.match(analysis, /if \(profile\?\.is_vip === true\)/);
  assert.match(proCard, /\/api\/match\/.*\/analysis/);
  assert.doesNotMatch(proCard, /createClient/);
  assert.doesNotMatch(mobileHub, /dbData\.pro_analysis/);
});
