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
const renderer = read('app/components/MarkdownRenderer.tsx');
const helper = read('lib/seo/json-ld.ts');

test('editorial reads use published-only PostgreSQL views and validate pagination inputs', () => {
  assert.ok(adapter.includes('FROM public.public_editorial_articles'));
  assert.ok(adapter.includes('FROM public.public_media_assets'));
  assert.ok(adapter.includes('limit > 50'));
  assert.ok(adapter.includes('offset > 5000'));
  assert.ok(adapter.includes('slug.length > 240'));
  assert.ok(adapter.includes('seo_title, seo_description, original_created_at, last_verified_at'));
});

test('R2 media delivery requires a rights-cleared database row and safe raster image type', () => {
  assert.ok(mediaRoute.includes('getPublicMediaAsset(key)'));
  assert.ok(mediaRoute.includes('SAFE_IMAGE_TYPES.has(asset.content_type)'));
  assert.ok(mediaRoute.includes('X-Content-Type-Options'));
  assert.ok(mediaRoute.includes('Content-Security-Policy'));
  assert.ok(mediaRoute.includes('Cache-Control'));
  assert.ok(!mediaRoute.includes('image/svg+xml'));
});

test('homepage, news listing and article pages support an explicit PostgreSQL editorial flag', () => {
  for (const source of [home, news, article]) assert.ok(source.includes("FACTSPORT_EDITORIAL_BACKEND === 'postgres'"));
  assert.ok(news.includes('listPublicEditorialArticles'));
  assert.ok(article.includes('getPublicEditorialArticle'));
});

test('article rendering sanitizes raw HTML and restricts iframe embeds to trusted providers', () => {
  assert.ok(renderer.includes("import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'"));
  assert.ok(renderer.includes('[rehypeSanitize, articleSanitizeSchema]'));
  assert.ok(renderer.includes('www.youtube.com'));
  assert.ok(renderer.includes('www.youtube-nocookie.com'));
  assert.ok(renderer.includes('player.vimeo.com'));
  assert.ok(renderer.includes("sandbox: 'allow-scripts allow-same-origin allow-presentation'"));
  assert.ok(renderer.includes('match-widget:'));
  assert.ok(!renderer.includes('match-widget-embed'));
});

test('article metadata uses approved SEO fields and safe JSON-LD serialization', () => {
  assert.ok(helper.includes(".replace(/</g, '\\\\u003c')"));
  assert.ok(helper.includes('toPlainText'));
  assert.ok(article.includes('serializeJsonLd(jsonLd)'));
  assert.ok(article.includes('article.seo_title'));
  assert.ok(article.includes('article.seo_description'));
  assert.ok(article.includes('article.canonical_url'));
});
