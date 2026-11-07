const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const disabledRoutes = [
  ['app/api/live/route.ts', 'docs/audit/legacy-source/api-live-route-v1.ts.txt'],
  ['app/api/sync-fd/route.ts', 'docs/audit/legacy-source/api-sync-fd-route-v1.ts.txt'],
  ['app/api/matchmaker/route.ts', 'docs/audit/legacy-source/api-matchmaker-route-v1.ts.txt'],
  ['app/api/settle/route.ts', 'docs/audit/legacy-source/api-settle-route-v1.ts.txt'],
  ['app/api/social/route.ts', 'docs/audit/legacy-source/api-social-route-v1.ts.txt'],
  ['app/api/cron/morning-post/route.ts', 'docs/audit/legacy-source/api-cron-morning-post-route-v1.ts.txt'],
  ['app/api/evening-roundup/route.ts', 'docs/audit/legacy-source/api-evening-roundup-route-v1.ts.txt'],
  ['app/api/logos/sync/route.ts', 'docs/audit/legacy-source/api-logos-sync-route-v1.ts.txt'],
  ['app/api/matches/highlights/sync/route.ts', 'docs/audit/legacy-source/api-matches-highlights-sync-route-v1.ts.txt'],
  ['app/api/admin/reset-monthly/route.ts', 'docs/audit/legacy-source/api-admin-reset-monthly-route-v1.ts.txt'],
  ['app/api/admin/run-audit/route.ts', 'docs/audit/legacy-source/api-admin-run-audit-route-v1.ts.txt'],
  ['app/api/admin/settings/route.ts', 'docs/audit/legacy-source/api-admin-settings-route-v1.ts.txt'],
  ['app/api/admin/users/route.ts', 'docs/audit/legacy-source/api-admin-users-route-v1.ts.txt'],
];

test('legacy Supabase side-effect endpoints are archived and fail closed in V2', () => {
  for (const [activePath, archivePath] of disabledRoutes) {
    const active = read(activePath);
    const archived = read(archivePath);
    if (activePath === 'app/api/social/route.ts') {
      assert.match(active, /status: 410/);
      assert.match(active, /V2_SOCIAL_DISPATCHER_NOT_PROVISIONED/);
    } else {
      assert.match(active, /legacyRouteDisabled|V2_LEGACY_ROUTE_DISABLED/);
    }
    assert.doesNotMatch(active, /createClient|getSupabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(archived, /Archived verbatim|Archived verbatim from/);
    assert.match(archived, /SUPABASE_SERVICE_ROLE_KEY|createClient|getSupabaseAdmin/);
  }
});

test('shared V2 legacy route guard returns 410 and no-store', () => {
  const guard = read('app/lib/v2/legacy-route-disabled.ts');
  assert.match(guard, /status: 410/);
  assert.match(guard, /Cache-Control': 'no-store'/);
  assert.match(guard, /V2_LEGACY_ROUTE_DISABLED/);
});
