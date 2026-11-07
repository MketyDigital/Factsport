/**
 * AdSense is deliberately opt-in and fail-closed. This policy only decides
 * whether a future public editorial slot may be rendered; it does not load
 * Google's script or create an ad unit. A certified CMP integration and
 * actual AdSense account/site approval are separate release prerequisites.
 */
const PUBLIC_EDITORIAL_PATHS = [
  /^\/$/,
  /^\/news\/?$/,
  /^\/news\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/,
] as const;

export type AdSenseGate = {
  enabled: boolean;
  approved: boolean;
  consentReady: boolean;
  publisherId?: string | null;
  hostname?: string | null;
};

export function isAdSenseEligiblePath(pathname: string): boolean {
  if (typeof pathname !== 'string' || pathname.length > 2048) return false;
  const normalized = pathname.split('?')[0].split('#')[0];
  if (/\/(admin|api|dashboard|account|login|register|auth|vip|predict|payment|checkout|chat|studio|settings)(\/|$)/i.test(normalized)) return false;
  if (/\/(match|matches|live|leaderboard|embed)(\/|$)/i.test(normalized)) return false;
  return PUBLIC_EDITORIAL_PATHS.some(pattern => pattern.test(normalized));
}

export function canRenderAdSense(pathname: string, gate: AdSenseGate): boolean {
  if (!gate.enabled || !gate.approved || !gate.consentReady) return false;
  if (gate.hostname?.toLowerCase() !== 'factsport.com') return false;
  if (!/^pub-[0-9]{16}$/.test(gate.publisherId || '')) return false;
  return isAdSenseEligiblePath(pathname);
}
