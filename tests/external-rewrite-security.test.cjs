const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Next config does not proxy requests and credentials to Cloudinary', () => {
  const config = fs.readFileSync('next.config.mjs', 'utf8');

  assert.doesNotMatch(config, /async\s+rewrites\s*\(/);
  assert.doesNotMatch(config, /res\.cloudinary\.com/);
});
