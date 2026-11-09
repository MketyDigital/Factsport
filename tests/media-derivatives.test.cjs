const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Media derivatives are immutable, linked to an original asset and inherit source rights', () => {
  const migration = read('db/migrations/0039_factsport_media_derivative_lineage.sql');
  const endpoint = read('app/api/admin/media/derivatives/route.ts');
  const editor = read('app/admin/media/MediaDerivativeEditor.tsx');
  const library = read('app/admin/media/MediaLibraryClient.tsx');
  const listing = read('app/api/admin/media/route.ts');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.media_asset_derivatives/);
  assert.match(migration, /source_asset_id uuid NOT NULL/);
  assert.match(migration, /derivative_asset_id uuid NOT NULL UNIQUE/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.media_asset_derivatives TO factsport_v2_editorial_writer/);
  assert.doesNotMatch(migration, /GRANT UPDATE|GRANT DELETE/);
  assert.match(migration, /reject_nested_media_derivative/);
  assert.equal((migration.match(/\bBEGIN;/g) || []).length, 1);
  assert.equal((migration.match(/\bCOMMIT;/g) || []).length, 1);
  assert.match(migration, /AS \$\$[\s\S]*?\$\$;/);
  assert.match(migration, /A derivative cannot be used as the source/);
  assert.match(endpoint, /isSameOriginRequest/);
  assert.match(endpoint, /image\/webp/);
  assert.match(endpoint, /PhotonImage\.new_from_byteslice/);
  assert.match(endpoint, /crop\(/);
  assert.match(endpoint, /SamplingFilter\.Lanczos3/);
  assert.match(endpoint, /get_bytes_webp/);
  assert.match(endpoint, /sourceHash !== source\.sha256/);
  assert.match(endpoint, /sourceObject\.arrayBuffer/);
  assert.match(endpoint, /imageDimensions\(source\.content_type, sourceBytes\)/);
  assert.match(endpoint, /FOR SHARE/);
  assert.match(endpoint, /NOT EXISTS \([\s\S]*?public\.media_asset_derivatives/);
  assert.match(endpoint, /rights_reviewed_by/);
  assert.match(endpoint, /usage_expires_at/);
  assert.match(endpoint, /media_asset_derivatives/);
  assert.match(endpoint, /media_derivative_created/);
  assert.match(endpoint, /factsportMediaBucket\(\)\.delete/);
  assert.match(editor, /createImageBitmap/);
  assert.match(editor, /drawImage/);
  assert.match(editor, /toBlob/);
  assert.match(editor, /Content-Type': 'application\/json'/);
  assert.doesNotMatch(editor, /new FormData\(\)|new File\(/);
  assert.match(editor, /focusX/);
  assert.match(editor, /focusY/);
  assert.match(editor, /hero_16_9/);
  assert.match(editor, /social_square/);
  assert.match(editor, /thumbnail_4_3/);
  assert.match(editor, /team_square/);
  assert.match(library, /MediaDerivativeEditor/);
  assert.match(listing, /media_asset_derivatives/);
  assert.match(listing, /derived_from/);
});

test('Every public Media projection rechecks the original asset rights for a derivative', () => {
  const migration = read('db/migrations/0039_factsport_media_derivative_lineage.sql');
  for (const view of [
    'public_media_assets',
    'public_social_media_assets',
    'public_editorial_article_inline_media',
    'public_editorial_articles',
  ]) {
    assert.ok(migration.includes('CREATE OR REPLACE VIEW public.' + view));
  }
  assert.ok((migration.match(/source\.rights_status NOT IN/g) || []).length >= 5);
  assert.ok(migration.includes('source.rights_reviewed_by IS NULL'));
  assert.ok(migration.includes('source.usage_expires_at <= now()'));
  assert.ok(migration.includes('GRANT SELECT ON public.public_social_media_assets TO factsport_v2_social_dispatcher'));
});

test('Editorial image ingestion and derivative processing enforce Worker memory bounds', () => {
  const inspection = read('lib/media/image-inspection.ts');
  const upload = read('app/api/admin/media/route.ts');
  const packageJson = JSON.parse(read('package.json'));
  assert.match(inspection, /MAX_EDITORIAL_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(inspection, /MAX_EDITORIAL_IMAGE_PIXELS = 8_000_000/);
  assert.match(inspection, /validImageSignature/);
  assert.match(inspection, /imageDimensions/);
  assert.match(upload, /MAX_EDITORIAL_IMAGE_BYTES/);
  assert.match(upload, /imageDimensions\(file\.type, bytes\)/);
  assert.equal(packageJson.dependencies['@cf-wasm/photon'], '^0.4.0');
});
