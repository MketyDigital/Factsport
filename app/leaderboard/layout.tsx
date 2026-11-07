import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Prediction Leaderboard | FactSport',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

/** Legacy VIP/prize leaderboard is Prediction-owned, not public Media inventory. */
export default async function PredictionLeaderboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const privateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase()
  if (!privateHost || privateHost.includes('://') || privateHost.includes('/')) notFound()
  const requestHeaders = await headers()
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0]
  if (requestHost !== privateHost) notFound()
  return children
}
