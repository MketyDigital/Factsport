import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'VIP Membership | FactSport',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

/**
 * VIP and paid prediction features belong to the private product surface.
 * The public Media host must not render this route. Configure the exact
 * private hostname (without scheme or path) only on its approved deployment.
 */
export default async function VipUpgradeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const configuredHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase()
  if (!configuredHost || configuredHost.includes('://') || configuredHost.includes('/')) notFound()

  const requestHeaders = await headers()
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0]

  if (!requestHost || requestHost !== configuredHost) notFound()
  return children
}
