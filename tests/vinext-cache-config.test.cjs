const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Cloudflare Vinext config wires ISR to Workers Cache', () => {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  const cloudflareConfig = fs.readFileSync('cloudflare.config.ts', 'utf8');

  assert.match(viteConfig, /workersCacheCdnAdapter\(\)/);
  assert.match(viteConfig, /cache:\s*\{\s*cdn:\s*workersCacheCdnAdapter\(\),?\s*\}/);
  assert.match(cloudflareConfig, /createWorkersCacheConfig\(\)/);
  assert.match(cloudflareConfig, /\.\.\.workersCache/);
  assert.match(cloudflareConfig, /\.\.\.workersCache\.env/);
  assert.match(cloudflareConfig, /\.\.\.workersCache\.exports/);
});
