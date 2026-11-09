const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Cloudflare Stream VOD is separate, signed, fail-closed and revision-scoped', () => {
  const migration = read('db/migrations/0041_factsport_media_video_assets.sql');
  const adapter = read('lib/media/cloudflare-stream.ts');
  const directUpload = read('app/api/admin/media/videos/direct-upload/route.ts');
  const refresh = read('app/api/admin/media/videos/[id]/refresh/route.ts');
  const playback = read('app/api/media/videos/[id]/playback/route.ts');
  const player = read('app/components/MediaVideoPlayer.tsx');
  const articleAdapter = read('lib/adapters/postgres-editorial.ts');
  const articlePage = read('app/news/[slug]/page.tsx');
  assert.match(migration, /media_video_assets/);
  assert.match(migration, /editorial_article_revision_videos/);
  assert.match(migration, /editorial_article_videos/);
  assert.match(migration, /public_editorial_article_video_tokens/);
  assert.match(migration, /signed_playback_required boolean NOT NULL DEFAULT true/);
  assert.match(migration, /rights_status IN \('owned','licensed','editorial_exception'\)/);
  assert.match(migration, /media_video_upload_started/);
  assert.match(adapter, /FACTSPORT_STREAM_VIDEO_READY === 'true'/);
  assert.match(adapter, /CLOUDFLARE_STREAM_SIGNING_KEY_JWK/);
  assert.match(adapter, /requireSignedURLs: true/);
  assert.match(adapter, /sub: videoUid/);
  assert.match(adapter, /RSASSA-PKCS1-v1_5/);
  assert.match(directUpload, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(directUpload, /isSameOriginRequest/);
  assert.match(directUpload, /createFactsportStreamDirectUpload/);
  const assetInsert = directUpload.match(/INSERT INTO public\.media_video_assets\s*\(([\s\S]*?)\)\s*VALUES/);
  assert.ok(assetInsert, 'video metadata insert must be explicit');
  assert.doesNotMatch(assetInsert[1], /uploadURL/i);
  assert.equal((migration.match(/\bBEGIN;/g) || []).length, 1);
  assert.equal((migration.match(/\bCOMMIT;/g) || []).length, 1);
  assert.ok(migration.trimEnd().endsWith('COMMIT;'));
  assert.match(refresh, /readyToStream/);
  assert.match(refresh, /expiredUnuploaded/);
  assert.match(playback, /public_editorial_article_video_tokens/);
  assert.match(playback, /createFactsportStreamSignedToken\(String\(rows\[0\]\.provider_video_id\)\)/);
  assert.match(playback, /\/iframe/);
  assert.match(player, /src={iframeUrl}/);
  assert.match(articleAdapter, /public\.public_editorial_article_videos/);
  assert.doesNotMatch(articleAdapter, /provider_video_id/);
  assert.match(articlePage, /MediaVideoPlayer/);
});

test('Video revisions preserve attachments and publication enforces current rights', () => {
  const actions = read('app/admin/news/actions.ts');
  const mediaActions = read('app/admin/news/media-actions.ts');
  const newsroom = read('app/admin/news/EditorialVideoAttachments.tsx');
  const usage = read('app/api/admin/media/videos/[id]/usage/route.ts');
  assert.match(actions, /editorial_article_revision_videos/);
  assert.match(actions, /A revision video is not processed or no longer has valid rights approval/);
  assert.match(actions, /isFactsportStreamVideoReady/);
  assert.match(actions, /editorial_article_videos/);
  assert.match(mediaActions, /reviewRightsAndAttachVideo/);
  assert.match(mediaActions, /removeEditorialVideoFromRevision/);
  assert.match(mediaActions, /revokeMediaVideoRights/);
  assert.match(newsroom, /Review rights &amp; attach video/);
  assert.match(usage, /editorial_article_revision_videos/);
  assert.match(usage, /editorial_article_videos/);
});

test('Large VOD files use protected Cloudflare TUS with durable resume and size integrity', () => {
  const migration = read('db/migrations/0041_factsport_media_video_assets.sql');
  const adapter = read('lib/media/cloudflare-stream.ts');
  const basicRoute = read('app/api/admin/media/videos/direct-upload/route.ts');
  const tusRoute = read('app/api/admin/media/videos/tus-upload/route.ts');
  const refresh = read('app/api/admin/media/videos/[id]/refresh/route.ts');
  const library = read('app/admin/media/MediaVideoLibrary.tsx');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(migration, /upload_protocol text NOT NULL DEFAULT 'basic'/);
  assert.match(migration, /upload_expected_size_bytes bigint/);
  assert.match(migration, /upload_expected_size_bytes > 0 AND upload_expected_size_bytes < 30000000000/);

  assert.match(adapter, /FACTSPORT_STREAM_BASIC_UPLOAD_MAX_BYTES = 200_000_000/);
  assert.match(adapter, /FACTSPORT_STREAM_MAX_UPLOAD_BYTES = 30_000_000_000/);
  assert.match(adapter, /createFactsportStreamTusUpload/);
  assert.match(adapter, /direct_user=true/);
  assert.match(adapter, /Tus-Resumable': '1\.0\.0'/);
  assert.match(adapter, /Upload-Length/);
  assert.match(adapter, /Upload-Metadata/);
  assert.match(adapter, /maxDurationSeconds/);
  assert.match(adapter, /requiresignedurls/);
  assert.match(adapter, /allowedorigins/);
  assert.match(adapter, /stream-media-id/);
  assert.match(adapter, /location\.pathname !== expectedPath/);

  assert.match(basicRoute, /fileSizeBytes >= 200_000_000/);
  assert.match(basicRoute, /fileType/);
  assert.match(basicRoute, /upload_protocol, upload_expected_size_bytes/);
  assert.match(tusRoute, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(tusRoute, /isSameOriginRequest/);
  assert.match(tusRoute, /Tus-Resumable/);
  assert.match(tusRoute, /upload-length/);
  assert.match(tusRoute, /Location: directUpload\.uploadURL/);
  assert.match(tusRoute, /X-Factsport-Video-Asset-Id/);
  const tusAssetInsert = tusRoute.match(/INSERT INTO public\.media_video_assets\s*\(([\s\S]*?)\)\s*VALUES/);
  assert.ok(tusAssetInsert, 'TUS upload metadata insert must be explicit');
  assert.doesNotMatch(tusAssetInsert[1], /uploadURL/i);
  assert.doesNotMatch(tusRoute, /CLOUDFLARE_STREAM_API_TOKEN|apiToken/);

  assert.match(library, /import \* as tus from 'tus-js-client'/);
  assert.match(library, /chunkSize: 50 \* 1024 \* 1024/);
  assert.match(library, /retryDelays: \[0, 3000, 5000, 10000, 20000\]/);
  assert.match(library, /findPreviousUploads/);
  assert.match(library, /resumeFromPreviousUpload/);
  assert.match(library, /storeFingerprintForResuming: true/);
  assert.match(library, /removeFingerprintOnSuccess: true/);
  assert.match(library, /onProgress:/);
  assert.match(library, /file\.size >= basicMaxBytes/);
  assert.match(library, /tus\.canStoreURLs/);
  assert.equal(packageJson.dependencies['tus-js-client'], '^4.3.1');

  assert.match(refresh, /upload_expected_size_bytes/);
  assert.match(refresh, /sizeMismatch/);
  assert.match(refresh, /uploaded_size_mismatch/);
  assert.match(refresh, /expiredUnuploaded \|\| sizeMismatch/);
});
