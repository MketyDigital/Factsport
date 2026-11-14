'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'v2-verify.yml'), 'utf8');

test('isolated V2 verification covers public pages, media, PWA and worker changes', () => {
  assert.match(workflow, /push:\\s*\\n\\s*branches:\\s*\\n\\s*- refactor\\/factsport-v2/);
  for (const glob of ['app/**', 'workers/**', 'public/**', 'scripts/**', 'db/**', '.github/workflows/**', 'tests/**']) {
    assert.ok(workflow.includes(`- '${glob}'`), `missing push path ${glob}`);
  }
  assert.match(workflow, /npm run test:engine/);
  assert.match(workflow, /npm run typecheck/);
});
