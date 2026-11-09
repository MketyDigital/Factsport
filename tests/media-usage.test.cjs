const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Media usage lookup discovers original/derivative references across articles and social publications', () => {
  const route = read('app/api/admin/media/[id]/usage/route.ts');
  const panel = read('app/admin/media/MediaUsagePanel.tsx');
  const library = read('app/admin/media/MediaLibraryClient.tsx');
  const revoke = read('app/admin/news/media-actions.ts');
  assert.match(route, /authorizeMediaEditorialAction\('media'\)/);
  assert.match(route, /media_asset_derivatives/);
  assert.match(route, /sourceObjectKey/);
  assert.match(route, /editorial_article_media/);
  assert.match(route, /editorial_article_team_media/);
  assert.match(route, /media_social_publications/);
  assert.match(route, /media_asset_ids && ids\.asset_ids/);
  assert.match(route, /Cache-Control/);
  assert.match(panel, /Editorial articles/);
  assert.match(panel, /Social publications/);
  assert.match(panel, /Published third-party posts remain/);
  assert.match(library, /MediaUsagePanel/);
  assert.match(revoke, /WITH affected_assets AS/);
  assert.match(revoke, /revalidatePath\('\/news\/' \+ slug\)/);
});
