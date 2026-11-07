const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scripts = [
  'scripts/sync-gh.js',
  'scripts/fetch-espn-cups.js',
  'scripts/generate-pro-slips.js',
  'scripts/daily-preview.js',
  'scripts/daily-summary.js',
];

for (const script of scripts) {
  test(`legacy automation script parses under the repository ESM mode: ${script}`, () => {
    const result = spawnSync(process.execPath, ['--check', path.resolve(script)], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || 'node --check failed');
  });
}
