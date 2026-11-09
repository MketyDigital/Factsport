import 'server-only';

export const isFactsportMediaDerivativesReady = () =>
  process.env.FACTSPORT_MEDIA_DERIVATIVES_READY === 'true';

export const isFactsportMediaRightsRevocationReady = () =>
  process.env.FACTSPORT_MEDIA_RIGHTS_REVOCATION_READY === 'true' &&
  isFactsportMediaDerivativesReady();

export const isFactsportMediaVideoSchemaReady = () =>
  process.env.FACTSPORT_MEDIA_VIDEO_SCHEMA_READY === 'true';

export const isFactsportEditorialSourceRevisionReady = () =>
  process.env.FACTSPORT_EDITORIAL_SOURCE_REVISION_READY === 'true';
