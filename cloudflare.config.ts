import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

const factsportWorker = defineWorker(async () => {
  const workersCache = await createWorkersCacheConfig();

  return {
    ...workersCache,

    name: "factsport-v2-staging",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-03",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      FACTSPORT_HYPERDRIVE: bindings.hyperdrive({
        id: "895cca4c06104b8ab9f7c1b72a8ba18f",
      }),
      FACTSPORT_EDITORIAL_HYPERDRIVE: bindings.hyperdrive({
        id: "57ee2a1f84744e74b2a51cee07f830a4",
      }),
      FACTSPORT_MEDIA_BUCKET: bindings.r2({
        name: "factsport-v2-media-staging",
      }),
      FACTSPORT_ENVIRONMENT: bindings.text("staging"),
      FACTSPORT_MATCHES_BACKEND: bindings.text("postgres"),
      // Keep unprovisioned readers explicitly disabled until their migrations and data are verified.
      FACTSPORT_MATCH_DETAIL_BACKEND: bindings.text("disabled"),
      FACTSPORT_COMPETITIONS_BACKEND: bindings.text("disabled"),
      FACTSPORT_HOMEPAGE_BACKEND: bindings.text("disabled"),
      FACTSPORT_PREDICTION_SETTINGS_BACKEND: bindings.text("disabled"),
      ...workersCache.env,
    },
    exports: { ...workersCache.exports },
  };
});

/**
 * Factsport v2 staging application. Never bind to the existing factsport.com
 * production route until parity and security checks have passed.
 */
export default defineConfig({
  worker: factsportWorker,
});
