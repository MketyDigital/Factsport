/**
 * Narrow Cloudflare binding types for the future vinext build.
 * Generated Wrangler types should replace this hand-written declaration
 * when the project migrates to Cloudflare Vite/vinext.
 */
declare module 'cloudflare:workers' {
  export const env: {
    FACTSPORT_ENVIRONMENT: string;
    FACTSPORT_STAGING_TOKEN?: string;
    FACTSPORT_MATCHES_BACKEND?: string;
    FACTSPORT_MATCH_DETAIL_BACKEND?: string;
    FACTSPORT_COMPETITIONS_BACKEND?: string;
    FACTSPORT_HOMEPAGE_BACKEND?: string;
    FACTSPORT_PREDICTION_SETTINGS_BACKEND?: string;
    FACTSPORT_PREDICTION_SUBMISSION_READY?: string;
    FACTSPORT_PUBLIC_MEDIA_HOST?: string;
    FACTSPORT_PREDICTION_RATE_LIMIT_SECRET?: string;
    FACTSPORT_HYPERDRIVE: { connectionString: string };
    FACTSPORT_MEDIA_BUCKET: {
      head(key: string): Promise<unknown | null>;
      get(key: string): Promise<unknown | null>;
      put(key: string, value: ArrayBuffer | string, options?: object): Promise<unknown>;
      delete(key: string): Promise<void>;
    };
  };
}
