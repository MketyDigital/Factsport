import { bindings, defineConfig, defineWorker } from "cf/config";

/**
 * Factsport v2 staging application. Never bind to the existing factsport.com
 * production route until parity and security checks have passed.
 */
export default defineConfig({
  worker: defineWorker({
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
        id: "08cee41a81be4c3980450be9563af5e2",
      }),
      FACTSPORT_MEDIA_BUCKET: bindings.r2({
        name: "factsport-v2-media-staging",
      }),
      FACTSPORT_ENVIRONMENT: bindings.text("staging"),
      FACTSPORT_MATCHES_BACKEND: bindings.text("postgres"),
    },
  }),
});
