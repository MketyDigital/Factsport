const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
  // Execute the exact regex from the player: static keyword checks would have
  // missed the escaped-backslash regression that stopped every .m3u8 match.
  const hlsExpression = player.match(/const isHls = (\/[^\n]+\/[a-z]*)\.test\(rawMediaPath\);/);
  assert.ok(hlsExpression, 'HLS detection expression must remain readable');
  const expression = hlsExpression[1];
  const splitAt = expression.lastIndexOf('/');
  const hlsRegex = new RegExp(expression.slice(1, splitAt), expression.slice(splitAt + 1));
  assert.equal(hlsRegex.test('/live/playlist.m3u8'), true);
  assert.equal(hlsRegex.test(new URL('https://cdn.example.org/live/playlist.m3u8?signature=a').pathname), true);
  assert.equal(hlsRegex.test('/live/playlist.M3U8'), true);
  assert.equal(hlsRegex.test('/live/playlist.mp4'), false);
  assert.ok(player.includes("media.canPlayType('application/vnd.apple.mpegurl')"));
  assert.ok(player.includes("void import('hls.js')"));
  assert.ok(player.includes('Hls.isSupported()'));
  assert.ok(player.includes('hls.loadSource(mediaUrl)'));
  assert.ok(player.includes('hls.attachMedia(media)'));
  assert.ok(player.includes('cleanup = () => hls.destroy()'));
  assert.ok(player.includes('src={isHls ? undefined : mediaUrl}'));
  assert.ok(player.includes("if (!isHls || !isSafeMediaUrl || isTimeLocked) return;"));
  assert.ok(player.includes("const media = mediaRef.current;"));
  assert.ok(!player.includes("mode === 'audio') return;"), 'HLS audio must use the fallback');
  assert.equal(player.split('src={isHls ? undefined : mediaUrl}').length - 1, 2,
    'HLS audio and video both defer source assignment to native HLS or hls.js');
});



test('legacy audio and video report playback failure and expose retry controls', () => {
  const player = read('app/components/FactSportPlayer.tsx');
  assert.match(player, /const \[playbackError, setPlaybackError\] = useState/);
  assert.match(player, /const playNativeMedia = \(\) =>/);
  assert.ok(player.includes('void media.play().then(() => {'));
  assert.ok(player.includes('setHasStarted(false);'));
  assert.ok(player.includes('setPlaybackError(\'Playback could not start.'));
  assert.ok(player.includes('playNativeMedia();'));
  assert.ok(player.includes('playbackError && <span role="alert"'));
  assert.equal(player.split('onPause={() => setIsPlaying(false)}').length - 1, 2);
  assert.equal(player.split('onEnded={() => setIsPlaying(false)}').length - 1, 2);
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

test('unapproved paid Cloudflare Stream VOD cannot activate via env flags or editor UI', () => {
  const stream = read('lib/media/cloudflare-stream.ts');
  const library = read('app/admin/media/MediaLibraryClient.tsx');
  const adminPage = read('app/admin/media/page.tsx');
  const newsroom = read('app/admin/news/NewsroomClient.tsx');
  assert.ok(stream.includes('const FACTSPORT_PAID_STREAM_OWNER_APPROVED = false;'));
  assert.ok(stream.includes('return FACTSPORT_PAID_STREAM_OWNER_APPROVED &&'));
  assert.doesNotMatch(library, /<MediaVideoLibrary/);
  assert.doesNotMatch(adminPage, /isFactsportStreamVideoReady/);
  assert.doesNotMatch(newsroom, /<EditorialVideoAttachments/);
  assert.doesNotMatch(newsroom, /<MediaVideoPreview/);
  assert.match(newsroom, /previewInline.length > 0/);
  assert.match(library, /MediaDerivativeEditor/);
  assert.match(library, /MediaUsagePanel/);
});

test('newsroom approved external video helper validates provider URLs and records rights', () => {
  const newsroom = read('app/admin/news/NewsroomClient.tsx');
  const renderer = read('app/components/MarkdownRenderer.tsx');
  const start = newsroom.indexOf('function approvedExternalVideo(');
  const end = newsroom.indexOf('export default function NewsroomClient', start);
  assert.ok(start >= 0 && end > start, 'approved provider helper must exist');
  const helper = newsroom.slice(start, end).replace(
    'function approvedExternalVideo(value: string): { embedUrl: string; sourceUrl: string; publisher: string } | null {',
    'function approvedExternalVideo(value) {',
  );
  const parse = vm.runInNewContext(helper + '\n;approvedExternalVideo', { URL }, { timeout: 1000 });
  const youtube = parse('https://youtu.be/abcdefghijk?t=30');
  assert.equal(youtube.embedUrl, 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(youtube.sourceUrl, 'https://www.youtube.com/watch?v=abcdefghijk');
  const vimeo = parse('https://vimeo.com/12345678');
  assert.equal(vimeo.embedUrl, 'https://player.vimeo.com/video/12345678');
  for (const bad of [
    'http://youtu.be/abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk',
    'javascript:alert(1)', 'https://vimeo.com.evil.test/12345678',
    'https://user:pass@www.youtube.com/watch?v=abcdefghijk',
    'https://www.youtube.com/watch?v=not-a-valid-video-id',
  ]) assert.equal(parse(bad), null, bad);

  assert.match(renderer, /www.youtube-nocookie.com/);
  assert.match(renderer, /player.vimeo.com/);
  assert.match(newsroom, /rightsReference: externalVideoRights/);
  assert.match(newsroom, /await attachExternalVideoToDraft/);
  assert.match(newsroom, /Attach video &amp; record rights atomically/);
  assert.match(newsroom, /expectedBody: form.bodyMarkdown/);
});

test('review and publish require revision-scoped external video attribution and rights evidence', () => {
  const actions = read('app/admin/news/actions.ts');
  const start = actions.indexOf('function externalVideoCanonicalUrls(');
  const end = actions.indexOf('function revalidateEditorial()', start);
  assert.ok(start >= 0 && end > start);
  const helper = actions.slice(start, end)
    .replace('function externalVideoCanonicalUrls(body: string): string[] {', 'function externalVideoCanonicalUrls(body) {')
    .replace('new Set<string>()', 'new Set()')
    .replace('let url: URL;', 'let url;')
    .replace(
      'function assertExternalVideoSourceRights(\n  body: string, sources: Array<{ canonical_url: string; attribution_text: string | null; rights_reference: string | null }>\n) {',
      'function assertExternalVideoSourceRights(body, sources) {',
    );
  const { externalVideoCanonicalUrls, assertExternalVideoSourceRights } = vm.runInNewContext(
    helper + '\n;({ externalVideoCanonicalUrls, assertExternalVideoSourceRights })', { URL }, { timeout: 1000 },
  );
  const yt = '<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk" title="Report"></iframe>';
  const vi = "<iframe src='https://player.vimeo.com/video/12345678'></iframe>";
  const sources = [
    { canonical_url: 'https://www.youtube.com/watch?v=abcdefghijk', attribution_text: 'Video credit', rights_reference: 'Permission recorded' },
    { canonical_url: 'https://vimeo.com/12345678', attribution_text: 'Vimeo credit', rights_reference: 'Editorial basis recorded' },
  ];
  assert.equal(Array.from(externalVideoCanonicalUrls(yt + '\n' + vi)).length, 2);
  assert.doesNotThrow(() => assertExternalVideoSourceRights(yt + '\n' + vi, sources));
  assert.throws(() => assertExternalVideoSourceRights(yt, []), /matching source/);
  assert.throws(() => assertExternalVideoSourceRights(vi, [{ ...sources[1], rights_reference: '' }]), /matching source/);
  assert.throws(() => assertExternalVideoSourceRights(yt, [{ ...sources[0], attribution_text: '' }]), /matching source/);
  assert.doesNotThrow(() => assertExternalVideoSourceRights('An article without embedded video', []));
  assert.ok(actions.includes("assertExternalVideoSourceRights(String(reviewSnapshot.body_markdown || ''), reviewSources)"));
  assert.ok(actions.includes("assertExternalVideoSourceRights(String(snapshot.body_markdown || ''), publishSources)"));
  assert.ok(actions.includes('FROM public.editorial_article_sources WHERE revision_id='));
});

test('atomic external video authoring locks draft, rejects stale bodies and commits provenance together', () => {
  const actions = read('app/admin/news/actions.ts');
  const newsroom = read('app/admin/news/NewsroomClient.tsx');
  const start = actions.indexOf('export async function attachExternalVideoToDraft(');
  assert.ok(start >= 0, 'atomic editorial action must exist');
  const atomic = actions.slice(start);
  assert.match(atomic, /authorizeMediaEditorialAction\('draft'\)/);
  assert.match(atomic, /sql\.begin\(async tx =>/);
  assert.match(atomic, /workflow_status='draft'/);
  assert.match(atomic, /ORDER BY revision_number DESC LIMIT 1 FOR UPDATE/);
  assert.match(atomic, /input\.expectedBody !== currentBody/);
  assert.match(atomic, /SELECT id, status FROM public\.editorial_articles/);
  assert.match(atomic, /INSERT INTO public\.editorial_article_sources/);
  assert.match(atomic, /UPDATE public\.editorial_article_revisions SET snapshot=/);
  assert.match(atomic, /body_markdown=\$\{updatedBody\}/);
  assert.match(atomic, /media_editorial_audit_events/);
  assert.match(atomic, /rightsReference/);
  assert.match(atomic, /url\.protocol !== 'https:'/);
  assert.match(newsroom, /attachExternalVideoToDraft\(\{/);
  assert.doesNotMatch(newsroom.slice(newsroom.indexOf('External editorial video')), /await addEditorialSource\(\{/);
});
