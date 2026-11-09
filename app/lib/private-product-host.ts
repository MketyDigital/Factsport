import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

/** Enforce the private Prediction hostname on server-rendered routes. */
export async function requirePrivateProductHost(): Promise<void> {
  const configuredHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  if (!configuredHost || configuredHost.includes('://') || configuredHost.includes('/')) notFound();

  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  if (!requestHost || requestHost !== configuredHost) notFound();
}


/** Keep Media-only authentication and administration off the private Prediction host. */
export async function rejectPrivateProductHost(): Promise<void> {
  const configuredHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  if (!configuredHost || configuredHost.includes('://') || configuredHost.includes('/')) return;

  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  if (requestHost && requestHost === configuredHost) notFound();
}
