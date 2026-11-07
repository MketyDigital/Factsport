const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adapter = read('lib/adapters/postgres-editorial.ts');
const mediaRoute = read('app/api/media/[...key]/route.ts');
const home = read('app/page.tsx');
const news = read('app/news/page.tsx');
const article = read('app/news/[slug]/page.tsx');

test('editorial reads use published-only PostgreSQL views and validate pagination inputs', () => {
  assert.match(adapter, /FROM public\.public_editorial_articles/i);
  assert.match(adapter, /FROM public\.public_media_assets/i);
  assert.match(adapter, /limit > 50/i);
  assert.match(adapter, /offset > 5000/i);
  assert.match(adapter, /slug\.length > 240/i);
});

test('R2 media delivery requires a rights-cleared database row and safe raster image type', () => {
  assert.match(mediaRoute, /getPublicMediaAsset\(key\)/);
  assert.match(mediaRoute, /SAFE_IMAGE_TYPES\.has\(asset\.content_type\)/);
  assert.match(mediaRoute, /X-Content-Type-Options/);
  assert.match(mediaRoute, /Content-Security-Policy/);
  assert.match(mediaRoute, /Cache-Control/);
  assert.doesNotMatch(mediaRoute, /image\/svg\+xml/i);
});

test('homepage, news listing and article pages support an explicit PostgreSQL editorial flag', () => {
  for (const source of [home, news, article]) {
    assert.match(source, /FACTSPORT_EDITORIAL_BACKEND === 'postgres'/);
  }
  assert.match(news, /listPublicEditorialArticles/);
  assert.match(article, /getPublicEditorialArticle/);
});
