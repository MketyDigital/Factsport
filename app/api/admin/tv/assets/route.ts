import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const MAX_MODEL_BYTES = 32 * 1024 * 1024;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const MODEL_KINDS = new Set(['stadium_environment', 'generic_player', 'football']);

function textField(form: FormData, key: string, maximum: number): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum) : '';
}

function validOptionalUrl(value: string): boolean {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

/** Validate a self-contained glTF 2.0 binary container before private storage. */
function validateGlb(buffer: ArrayBuffer): { ok: true; json: Record<string, unknown> } | { ok: false; error: string } {
  if (buffer.byteLength < 20 || buffer.byteLength > MAX_MODEL_BYTES) return { ok: false, error: 'The GLB file size is invalid.' };
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x67 || bytes[1] !== 0x6c || bytes[2] !== 0x54 || bytes[3] !== 0x46) {
    return { ok: false, error: 'The upload is not a valid GLB model.' };
  }
  const view = new DataView(buffer);
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    return { ok: false, error: 'Only complete glTF 2.0 binary models are accepted.' };
  }

  let offset = 12;
  let json: Record<string, unknown> | null = null;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) return { ok: false, error: 'The GLB container has an incomplete chunk.' };
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.byteLength || chunkLength % 4 !== 0) return { ok: false, error: 'The GLB container has an invalid chunk length.' };
    if (chunkIndex === 0) {
      if (chunkType !== 0x4e4f534a || chunkLength > 4 * 1024 * 1024) return { ok: false, error: 'The GLB JSON header is invalid or too large.' };
      try {
        const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(chunkStart, chunkEnd)).trim();
        const parsed = JSON.parse(source) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'The GLB scene description is invalid.' };
        json = parsed as Record<string, unknown>;
      } catch {
        return { ok: false, error: 'The GLB scene description is invalid.' };
      }
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  if (offset !== bytes.byteLength || !json || !json.asset || typeof json.asset !== 'object' ||
      (json.asset as { version?: unknown }).version !== '2.0') {
    return { ok: false, error: 'A valid glTF 2.0 JSON scene is required.' };
  }

  const stack: unknown[] = [json];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, value] of Object.entries(current)) {
      if (key === 'uri' && typeof value === 'string' && !value.startsWith('data:')) {
        return { ok: false, error: 'External file references are not accepted; submit a self-contained GLB.' };
      }
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return { ok: true, json };
}

/** Private GLB library. Uploads are never rights-cleared by this endpoint. */
export async function GET(request: Request) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });

  const url = new URL(request.url);
  const episodeId = url.searchParams.get('episodeId') || '';
  if (episodeId && !UUID.test(episodeId)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  try {
    const assets = await withFactsportEditorialPostgres(sql => episodeId
      ? sql`
          SELECT library.id, library.asset_kind, library.content_type, library.byte_size,
                 library.sha256, library.rights_status, library.provenance, library.created_at,
                 true AS linked_to_episode
          FROM public.factsport_tv_asset_library library
          WHERE EXISTS (
            SELECT 1 FROM public.factsport_tv_episode_asset_links link
            WHERE link.asset_id = library.id AND link.episode_id = ${episodeId}::uuid
          )
          ORDER BY library.created_at DESC
          LIMIT 100
        `
      : sql`
          SELECT library.id, library.asset_kind, library.content_type, library.byte_size,
                 library.sha256, library.rights_status, library.provenance, library.created_at,
                 EXISTS (
                   SELECT 1 FROM public.factsport_tv_episode_asset_links link
                   WHERE link.asset_id = library.id
                 ) AS linked_to_episode
          FROM public.factsport_tv_asset_library library
          ORDER BY library.created_at DESC
          LIMIT 100
        `);
    return NextResponse.json({ success: true, assets }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV model library unavailable', error);
    return NextResponse.json({ error: 'TV model library is not available.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get('content-length') || 0) > MAX_MODEL_BYTES + 128 * 1024) {
    return NextResponse.json({ error: 'The GLB upload exceeds the 32 MB limit.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: 'A multipart GLB upload is required.' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const file = form.get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.glb') ||
      !['model/gltf-binary', 'application/octet-stream', 'application/gltf-binary'].includes(file.type) ||
      file.size < 20 || file.size > MAX_MODEL_BYTES) {
    return NextResponse.json({ error: 'Upload a self-contained .glb stadium, player or football model up to 32 MB.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const kind = textField(form, 'assetKind', 40);
  if (!MODEL_KINDS.has(kind)) return NextResponse.json({ error: 'Choose a supported 3D model type.' }, { status: 400, headers: PRIVATE_HEADERS });
  const episodeId = textField(form, 'episodeId', 50);
  if (episodeId && !UUID.test(episodeId)) return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  const sourceName = textField(form, 'sourceName', 240);
  const sourceUrl = textField(form, 'sourceUrl', 1000);
  const licenseName = textField(form, 'licenseName', 240);
  const licenseUrl = textField(form, 'licenseUrl', 1000);
  const attribution = textField(form, 'attribution', 1000);
  const submittedNotes = textField(form, 'notes', 2000);
  if (!validOptionalUrl(sourceUrl) || !validOptionalUrl(licenseUrl)) {
    return NextResponse.json({ error: 'Source and license links must use HTTPS.' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  let objectKey: string | null = null;
  let uploaded = false;
  let bucket: ReturnType<typeof factsportMediaBucket> | null = null;
  try {
    const buffer = await file.arrayBuffer();
    const validation = validateGlb(buffer);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400, headers: PRIVATE_HEADERS });

    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const id = crypto.randomUUID();
    objectKey = `tv/models/${id}.glb`;
    bucket = factsportMediaBucket();
    await bucket.put(objectKey, buffer, {
      httpMetadata: { contentType: 'model/gltf-binary', cacheControl: 'private, no-store' },
    });
    uploaded = true;

    const provenance = {
      sourceName: sourceName || 'Not provided; owner upload',
      sourceUrl: sourceUrl || null,
      licenseName: licenseName || 'Not provided; rights review required',
      licenseUrl: licenseUrl || null,
      attribution: attribution || null,
      submittedNotes: submittedNotes || null,
      submissionClaim: 'owner_submitted_unverified',
      verifiedByFactsport: false,
      originalFilename: file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180),
      gltfVersion: '2.0',
      sceneNodeCount: Array.isArray(validation.json.nodes) ? validation.json.nodes.length : null,
    };
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      if (episodeId) {
        const episode = await tx`SELECT id FROM public.factsport_tv_episodes WHERE id = ${episodeId}::uuid FOR SHARE`;
        if (!episode[0]) return { kind: 'not_found' as const };
      }
      const rows = await tx`
        INSERT INTO public.factsport_tv_asset_library
          (asset_kind, object_key, content_type, byte_size, sha256, rights_status, provenance, created_by)
        VALUES (
          ${kind}, ${objectKey}, 'model/gltf-binary', ${file.size}, ${sha256},
          'pending', ${JSON.stringify(provenance)}::jsonb, ${authorization.user.domainUserId}::uuid
        )
        RETURNING id, asset_kind, content_type, byte_size, sha256, rights_status, provenance, created_at
      `;
      if (episodeId) {
        await tx`
          INSERT INTO public.factsport_tv_episode_asset_links (episode_id, asset_id, usage_role, created_by)
          VALUES (${episodeId}::uuid, ${rows[0].id}::uuid, ${kind}, ${authorization.user.domainUserId}::uuid)
        `;
      }
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          ${episodeId ? episodeId : null}::uuid, ${authorization.user.domainUserId}::uuid,
          'asset_uploaded',
          ${JSON.stringify({ assetId: rows[0].id, assetKind: kind, byteSize: file.size, sha256, rightsStatus: 'pending', linkedToEpisode: Boolean(episodeId) })}::jsonb
        )
      `;
      return { kind: 'ok' as const, asset: rows[0] };
    }));
    if (result.kind === 'not_found') {
      await bucket.delete(objectKey);
      uploaded = false;
      return NextResponse.json({ error: 'Episode not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({
      success: true,
      asset: result.asset,
      rightsStatus: 'pending',
      usableInRender: false,
      message: 'Stored privately. Rights and license claims require review before this model can be rendered or published.',
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (uploaded && bucket && objectKey) {
      try { await bucket.delete(objectKey); } catch { console.error('Factsport TV orphaned a private model object after database failure'); }
    }
    console.error('Factsport TV GLB upload failed', error);
    return NextResponse.json({ error: 'The private TV model upload could not be saved.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
