/**
 * Generate a bundled, allowlisted first migration for a temporary Cloudflare Worker.
 * Never source SQL from external requests. Exit on unexpected schema changes.
 */
const fs = require('node:fs');
const path = require('node:path');

const input = path.join(__dirname, '../db/migrations/0001_factsport_core.sql');
const output = path.join(__dirname, '../workers/generated-factsport-migration.ts');
const sql = fs.readFileSync(input, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .trim();
const pieces = sql.split(';').map((s) => s.trim()).filter(Boolean);
if (pieces[0] !== 'BEGIN' || pieces[pieces.length - 1] !== 'COMMIT') {
  throw new Error('Expected explicit BEGIN / COMMIT around reviewed Factsport migration');
}
const statements = pieces.slice(1, -1);
if (statements.length < 7 || statements.length > 20 ||
    statements.some((stmt) => !/^(CREATE TABLE IF NOT EXISTS public\.(matches|app_users|external_identities|job_runs)|CREATE INDEX IF NOT EXISTS (matches_league_date_idx|matches_status_date_idx|external_identities_user_idx)|CREATE EXTENSION IF NOT EXISTS pgcrypto)\b/i.test(stmt)) ||
    statements.some((stmt) => /\b(DROP|TRUNCATE|UPDATE|INSERT|ALTER\s+ROLE|GRANT|REVOKE)\b/i.test(stmt) || /\bDELETE\s+FROM\b/i.test(stmt))) {
  throw new Error('Unexpected SQL statement in bootstrap migration; review before deploying');
}
fs.writeFileSync(output, '/* Generated from db/migrations/0001_factsport_core.sql; do not edit. */\n' +
  'export const factsportMigrationStatements: string[] = ' +
  JSON.stringify(statements, null, 2) + ';\n');
console.log('Factsport first-schema migration bundled and validated (' + statements.length + ' statements)');
