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
const matchHeader = read('app/components/MatchHeaderClient.tsx');

test('match center scoreboard scales responsively and preserves unknown scores', () => {
  assert.match(matchHeader, /const homeScore = liveData\?\.home_score \?\? dbData\?\.home_score \?\? null/);
  assert.match(matchHeader, /const awayScore = liveData\?\.away_score \?\? dbData\?\.away_score \?\? null/);
  assert.match(matchHeader, /\{homeScore \?\? '–'\}/);
  assert.match(matchHeader, /\{awayScore \?\? '–'\}/);
  assert.doesNotMatch(matchHeader, /home_score \?\? 0|away_score \?\? 0/);
  assert.match(matchHeader, /md:text-6xl/);
  assert.match(matchHeader, /focus-visible:ring-2/);
  assert.match(matchHeader, /aria-live="polite"/);
});

test('match page does not serialize raw stream or VIP analysis data into client props', () => {
  assert.match(page, /const clientMatchData = \{/);
  assert.match(page, /MatchHeaderClient dbData=\{clientMatchData\}/);
  assert.match(page, /MatchMobileHub matchId=\{dbData\.id\} espnId=\{dbData\.espn_id\} dbData=\{clientMatchData\}/);
  assert.doesNotMatch(page, /mediaUrl=\{activeVideoUrl\}|mediaUrl=\{activeAudioUrl\}/);
  assert.doesNotMatch(page, /pro_analysis|campaign_id/);
  assert.match(page, /mediaUnlocked = isFinished \|\| isLive/);
  assert.match(page, /const LIVE_STATUSES = \[/);
  assert.doesNotMatch(page, /!SCHEDULED_STATUSES\.includes/);
  assert.match(page, /trimmed\.toLowerCase\(\) === 'streamio'/);
  assert.match(page, /new URL\(trimmed, 'https:\/\/factsport\.invalid'\)/);
  assert.match(page, /announcement_text, announcement_link, announcement_enabled/);
});

test('playback endpoint withholds media URLs until the server-side 15-minute unlock', () => {
  assert.match(playback, /getPostgresMatchPlaybackById\(id\)/);
  assert.match(playback, /FACTSPORT_MATCH_DETAIL_BACKEND/);
  assert.doesNotMatch(playback, /supabase|createClient|\.from\(/i);
  assert.match(playback, /Date\.now\(\) < unlockAt/);
  assert.match(playback, /const isLive = LIVE\.has\(status\)/);
  assert.doesNotMatch(playback, /!SCHEDULED\.has\(status\) && !isFinished/);
  assert.match(playback, /UNAVAILABLE\.has\(status\)/);
  assert.match(playback, /trimmed\.startsWith\('\/'\)/);
  assert.match(playback, /String\.fromCharCode\(92\)/);
  assert.match(playback, /const isLive = LIVE\.has\(status\)/);
  assert.doesNotMatch(playback, /!SCHEDULED\.has\(status\) && !isFinished/);
  assert.match(playback, /UNAVAILABLE\.has\(status\)/);
  assert.match(playback, /trimmed\.startsWith\('\/'\)/);
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
