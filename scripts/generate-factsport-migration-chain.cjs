/**
 * Bundle the reviewed ordered SQL migration chain for the temporary V2
 * migration Worker. Inputs are repository files only; no request can supply SQL.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const migrationDirectory = path.join(__dirname, '../db/migrations');
const outputFile = path.join(__dirname, '../workers/generated-factsport-migration-chain.ts');
const files = fs.readdirSync(migrationDirectory)
  .filter((name) => /^\\d{4}_[a-z0-9_]+\\.sql$/.test(name))
  .sort();

if (!files.length) throw new Error('No numbered Factsport SQL migrations found');

const migrations = files.map((filename, index) => {
  const version = Number(filename.slice(0, 4));
  if (version !== index) {
    throw new Error(`Migration sequence must start at 0000 and be contiguous; found ${filename}`);
  }
  const raw = fs.readFileSync(path.join(migrationDirectory, filename), 'utf8');
  const lines = raw.replace(/\\r\\n/g, '\\n').split('\\n');
  const substantive = (line) => line.trim() && !line.trimStart().startsWith('--');
  const first = lines.findIndex(substantive);
  let last = lines.length - 1;
  while (last >= 0 && !substantive(lines[last])) last--;
  if (first < 0 || lines[first].trim().toUpperCase() !== 'BEGIN;' ||
      last < first || lines[last].trim().toUpperCase() !== 'COMMIT;') {
    throw new Error(`Expected one outer BEGIN/COMMIT transaction in ${filename}`);
  }
  const sql = lines.slice(first + 1, last).join('\\n').trim();
  if (!sql) throw new Error(`Migration body is empty: ${filename}`);
  return {
    version,
    filename,
    checksumSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    sql,
  };
});

const generated = '/* Generated from db/migrations; do not edit. */\\n' +
  'export interface FactsportMigration { version: number; filename: string; checksumSha256: string; sql: string }\\n' +
  'export const FACTSPORT_MIGRATIONS: FactsportMigration[] = ' +
  JSON.stringify(migrations, null, 2) + ';\\n';
fs.writeFileSync(outputFile, generated);
console.log(`Bundled ${migrations.length} ordered Factsport migrations for the isolated migration Worker.`);
