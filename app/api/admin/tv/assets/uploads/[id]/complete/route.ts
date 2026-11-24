import { NextResponse } from 'next/server';
import { authorizeMediaEditorialAction } from '@/app/lib/admin/v2-editorial-authorization';
import { isSameOriginRequest } from '@/app/lib/admin/authorization';
import { factsportMediaBucket } from '@/lib/adapters/factsport-cloudflare-bindings';
import { withFactsportEditorialPostgres } from '@/lib/adapters/postgres-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_JSON_CHUNK_BYTES = 4 * 1024 * 1024;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

type GlbHeader = { ok: true; sceneNodeCount: number | null } | { ok: false; error: string };
function validateGlbHeader(buffer: ArrayBuffer, expectedSize: number): GlbHeader {
  if (buffer.byteLength < 20) return { ok: false, error: 'The completed upload is too small to be a GLB model.' };
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes[0] !== 0x67 || bytes[1] !== 0x6c || bytes[2] !== 0x54 || bytes[3] !== 0x46 ||
      view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== expectedSize) {
    return { ok: false, error: 'The completed file is not a size-matched glTF 2.0 binary model.' };
  }
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  const jsonEnd = 20 + jsonLength;
  if (jsonType !== 0x4e4f534a || jsonLength < 2 || jsonLength > MAX_JSON_CHUNK_BYTES || jsonEnd > bytes.byteLength) {
    return { ok: false, error: 'The GLB JSON header is invalid or exceeds the 4 MiB validation limit.' };
  }
  let json: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, jsonEnd)).trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid gltf');
    json = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'The GLB JSON scene is invalid.' };
  }
  if (!json.asset || typeof json.asset !== 'object' || (json.asset as { version?: unknown }).version !== '2.0') {
    return { ok: false, error: 'The file does not declare glTF 2.0.' };
  }
  const stack: unknown[] = [json];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) { stack.push(...value); continue; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'uri' && typeof child === 'string' && !child.startsWith('data:')) {
        return { ok: false, error: 'External model resources are not accepted; use a self-contained GLB.' };
      }
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  if (jsonEnd < expectedSize) {
    if (jsonEnd + 8 > bytes.byteLength) return { ok: false, error: 'The GLB binary chunk header is missing.' };
    const binLength = view.getUint32(jsonEnd, true);
    const binType = view.getUint32(jsonEnd + 4, true);
    if (binType !== 0x004e4942 || jsonEnd + 8 + binLength !== expectedSize) {
      return { ok: false, error: 'The GLB binary chunk bounds do not match the uploaded file.' };
    }
  } else if (jsonEnd !== expectedSize) {
    return { ok: false, error: 'Unexpected bytes follow the GLB JSON chunk.' };
  }
  return { ok: true, sceneNodeCount: Array.isArray(json.nodes) ? json.nodes.length : null };
}

type Session = {
  id: string; created_by: string; episode_id: string | null; asset_kind: string;
  object_key: string; r2_upload_id: string; expected_size: number; part_size: number;
  expected_part_count: number; original_filename: string; provenance: Record<string, unknown>;
  status: string; asset_id: string | null;
};
type Part = { part_number: number; byte_size: number; etag: string; sha256: string };

export async function POST(request: Request, context: { params: { id: string } }) {
  const authorization = await authorizeMediaEditorialAction('tv');
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers: PRIVATE_HEADERS });
  const id = context.params?.id || '';
  if (!UUID.test(id)) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });

  let session: Session | undefined;
  let parts: Part[] = [];
  try {
    const rows = await withFactsportEditorialPostgres(sql => sql`
      SELECT id, created_by, episode_id, asset_kind, object_key, r2_upload_id, expected_size,
             part_size, expected_part_count, original_filename, provenance, status, asset_id
      FROM public.factsport_tv_model_upload_sessions
      WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
        AND expires_at > now()
      LIMIT 1
    `);
    session = rows[0] as typeof session;
    if (!session) return NextResponse.json({ error: 'Upload session not found or expired.' }, { status: 404, headers: PRIVATE_HEADERS });
    if (session.status === 'completed' && session.asset_id) {
      const assets = await withFactsportEditorialPostgres(sql => sql`
        SELECT id, asset_kind, content_type, byte_size, sha256, rights_status, provenance, created_at
        FROM public.factsport_tv_asset_library WHERE id = ${session!.asset_id}::uuid LIMIT 1
      `);
      return NextResponse.json({ success: true, alreadyCompleted: true, asset: assets[0] }, { headers: PRIVATE_HEADERS });
    }
    if (session.status !== 'uploading' && session.status !== 'completing') {
      return NextResponse.json({ error: 'This upload session cannot be completed.' }, { status: 409, headers: PRIVATE_HEADERS });
    }
    parts = await withFactsportEditorialPostgres(sql => sql`
      SELECT part_number, byte_size, etag, sha256
      FROM public.factsport_tv_model_upload_parts
      WHERE session_id = ${id}::uuid
      ORDER BY part_number
    `) as Part[];
    if (parts.length !== session.expected_part_count || parts.some((part, index) => part.part_number !== index + 1)) {
      return NextResponse.json({ error: 'Some parts are missing. Resume the upload and send the remaining parts.' }, { status: 409, headers: PRIVATE_HEADERS });
    }
    const totalBytes = parts.reduce((sum, part) => sum + Number(part.byte_size), 0);
    if (totalBytes !== Number(session.expected_size)) return NextResponse.json({ error: 'Uploaded part sizes do not match the original file size.' }, { status: 409, headers: PRIVATE_HEADERS });
    await withFactsportEditorialPostgres(sql => sql`
      UPDATE public.factsport_tv_model_upload_sessions
      SET status = 'completing', updated_at = now()
      WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
        AND status IN ('uploading', 'completing')
    `);
  } catch (error) {
    console.error('Factsport TV multipart upload verification failed', error);
    return NextResponse.json({ error: 'Upload parts could not be verified.' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  if (!session) return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
  const bucket = factsportMediaBucket();
  try {
    const existing = await bucket.head(session.object_key) as { size?: number } | null;
    if (!existing) {
      const multipart = bucket.resumeMultipartUpload(session.object_key, session.r2_upload_id);
      try {
        await multipart.complete(parts.map(part => ({ partNumber: Number(part.part_number), etag: part.etag })));
      } catch (error) {
        const completed = await bucket.head(session.object_key) as { size?: number } | null;
        if (!completed || Number(completed.size) !== Number(session.expected_size)) throw error;
      }
    }
    const object = await bucket.head(session.object_key) as { size?: number } | null;
    if (!object || Number(object.size) !== Number(session.expected_size)) throw new Error('completed_object_size_mismatch');
    const headerObject = await bucket.get(session.object_key, { range: { offset: 0, length: MAX_JSON_CHUNK_BYTES + 28 } });
    if (!headerObject) throw new Error('completed_object_unavailable');
    const validation = validateGlbHeader(await headerObject.arrayBuffer(), Number(session.expected_size));
    if (!validation.ok) {
      await bucket.delete(session.object_key);
      await withFactsportEditorialPostgres(sql => sql`
        UPDATE public.factsport_tv_model_upload_sessions SET status = 'failed', updated_at = now()
        WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
      `);
      return NextResponse.json({ error: validation.error }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const manifest = parts.map(part => `${part.part_number}:${part.byte_size}:${part.sha256}`).join('\n');
    const manifestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(manifest));
    const integrityDigest = Array.from(new Uint8Array(manifestHash), byte => byte.toString(16).padStart(2, '0')).join('');
    const provenance = {
      ...session.provenance,
      sceneNodeCount: validation.sceneNodeCount,
      integrity: { algorithm: 'SHA-256', scope: 'ordered-part-manifest-v1', partCount: parts.length },
    };
    const result = await withFactsportEditorialPostgres(sql => sql.begin(async tx => {
      const locked = await tx`
        SELECT status, asset_id FROM public.factsport_tv_model_upload_sessions
        WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
        FOR UPDATE
      `;
      if (!locked[0]) return { kind: 'not_found' as const };
      if (locked[0].status === 'completed' && locked[0].asset_id) {
        const existingAsset = await tx`
          SELECT id, asset_kind, content_type, byte_size, sha256, rights_status, provenance, created_at
          FROM public.factsport_tv_asset_library WHERE id = ${locked[0].asset_id}::uuid LIMIT 1
        `;
        return { kind: 'ok' as const, asset: existingAsset[0] };
      }
      const inserted = await tx`
        INSERT INTO public.factsport_tv_asset_library
          (asset_kind, object_key, content_type, byte_size, sha256, rights_status, provenance, created_by)
        VALUES (
          ${session!.asset_kind}, ${session!.object_key}, 'model/gltf-binary', ${session!.expected_size},
          ${integrityDigest}, 'pending', ${JSON.stringify(provenance)}::jsonb,
          ${authorization.user.domainUserId}::uuid
        )
        RETURNING id, asset_kind, content_type, byte_size, sha256, rights_status, provenance, created_at
      `;
      if (session!.episode_id) {
        await tx`
          INSERT INTO public.factsport_tv_episode_asset_links (episode_id, asset_id, usage_role, created_by)
          VALUES (${session!.episode_id}::uuid, ${inserted[0].id}::uuid, ${session!.asset_kind}, ${authorization.user.domainUserId}::uuid)
          ON CONFLICT (episode_id, asset_id, usage_role) DO NOTHING
        `;
      }
      await tx`
        INSERT INTO public.factsport_tv_audit_events (episode_id, actor_user_id, action, details)
        VALUES (
          ${session!.episode_id}::uuid, ${authorization.user.domainUserId}::uuid, 'asset_uploaded',
          ${JSON.stringify({ assetId: inserted[0].id, assetKind: session!.asset_kind, byteSize: session!.expected_size, integrityDigest, integrityScope: 'ordered-part-manifest-v1', rightsStatus: 'pending', uploadMode: 'r2_multipart' })}::jsonb
        )
      `;
      await tx`
        UPDATE public.factsport_tv_model_upload_sessions
        SET status = 'completed', asset_id = ${inserted[0].id}::uuid, updated_at = now()
        WHERE id = ${id}::uuid AND created_by = ${authorization.user.domainUserId}::uuid
      `;
      return { kind: 'ok' as const, asset: inserted[0] };
    }));
    if (result.kind === 'not_found') return NextResponse.json({ error: 'Upload session not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    return NextResponse.json({
      success: true,
      asset: result.asset,
      rightsStatus: 'pending',
      usableInRender: false,
      message: 'Large model stored privately. Its rights remain pending until an independent media admin reviews the license evidence.',
    }, { status: 201, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('Factsport TV multipart model completion failed', error);
    return NextResponse.json({ error: 'The upload is retained. Check its status and retry completion.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
