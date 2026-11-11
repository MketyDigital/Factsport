const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const provider = () => fs.readFileSync(path.join(__dirname, '..', 'app/providers/GlobalMediaProvider.tsx'), 'utf8');

test('Stream.io disconnect acts on refs rather than stale React state', () => {
  const source = provider();
  assert.match(source, /const activeClientRef = useRef<StreamVideoClient \| null>\(null\)/);
  assert.match(source, /const activeCallRef = useRef<Call \| null>\(null\)/);
  assert.match(source, /const sessionRef = useRef\(0\)/);
  const stop = source.slice(source.indexOf('const stopMedia = async () =>'), source.indexOf('const tuneInVideo ='));
  assert.match(stop, /\+\+sessionRef\.current/);
  assert.match(stop, /const previousCall = activeCallRef\.current/);
  assert.match(stop, /const previousClient = activeClientRef\.current/);
  assert.match(stop, /activeCallRef\.current = null/);
  assert.match(stop, /activeClientRef\.current = null/);
  assert.match(stop, /previousCall\?\.leave\(\)\.catch/);
  assert.match(stop, /previousClient\?\.disconnectUser\(\)\.catch/);
  assert.doesNotMatch(stop, /if \(call\) await call\.leave\(\)/);
});

test('Stream.io wait-for-host loop cannot outlive listener choice or overlap retries', () => {
  const source = provider();
  const audio = source.slice(source.indexOf('const tuneInAudio = async'), source.indexOf('useEffect(() => { return () =>'));
  assert.match(audio, /const stopping = stopMedia\(\)/);
  assert.match(audio, /const stoppedSession = sessionRef\.current/);
  assert.match(audio, /if \(stoppedSession !== sessionRef\.current\) return/);
  assert.match(audio, /const session = \+\+sessionRef\.current/);
  assert.match(audio, /if \(session !== sessionRef\.current\) return/);
  assert.match(audio, /activeCallRef\.current = myCall/);
  assert.match(audio, /activeClientRef\.current = myClient/);
  assert.match(audio, /let retryInProgress = false/);
  assert.match(audio, /document\.hidden \|\| retryInProgress \|\| session !== sessionRef\.current/);
  assert.match(audio, /finally \{\s*retryInProgress = false/);
  assert.match(audio, /await myCall\.leave\(\)\.catch/);
  assert.match(audio, /await myClient\.disconnectUser\(\)\.catch/);
  assert.match(source, /if \(pollRef\.current\) clearInterval\(pollRef\.current\)/);
  assert.match(source, /void stopMedia\(\)/);
});

test('Stream.io signed room-token and owner-required call-in gates remain', () => {
  const source = provider();
  assert.match(source, /fetch\('\/api\/studio\/token'/);
  assert.match(source, /inviteToken: guestToken \|\| undefined/);
  assert.match(source, /setCanRequestCallIn\(data\.canRequestCallIn === true\)/);
  assert.match(source, /myClient\.call\('audio_room', data\.roomName \|\| matchId\)/);
  assert.match(source, /data\.role === 'admin'/);
  assert.match(source, /if \(document\.hidden/);
});
