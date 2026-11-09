/**
 * Factsport v2 Cloudflare-only server module, intended for vinext routes/actions.
 * Do not import from the existing Next.js 14 build until vinext cutover.
 * Native R2 bindings need no S3 keys or R2 endpoint secrets.
 */
import { env } from 'cloudflare:workers';
import postgres from 'postgres';

export function factsportPostgres() {
  const hyperdrive = env.FACTSPORT_HYPERDRIVE as { connectionString: string };
  if (!hyperdrive?.connectionString) {
    throw new Error('FACTSPORT_HYPERDRIVE binding missing');
  }
  return postgres(hyperdrive.connectionString, {
    max: 1,
    fetch_types: false,
    prepare: true,
    connect_timeout: 10,
    idle_timeout: 5,
  });
}

export function factsportMediaBucket() {
  const bucket = env.FACTSPORT_MEDIA_BUCKET as {
    head: (key: string) => Promise<unknown | null>;
    get: (key: string) => Promise<{ size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null>;
    put: (key: string, data: ArrayBuffer | string, options?: object) => Promise<unknown>;
    delete: (key: string) => Promise<void>;
  };
  if (!bucket?.head) throw new Error('FACTSPORT_MEDIA_BUCKET binding missing');
  return bucket;
}
