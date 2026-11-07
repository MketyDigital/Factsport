import type { Metadata } from 'next';
import { requirePrivateProductHost } from '@/app/lib/private-product-host';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function PrivatePredictionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requirePrivateProductHost();
  return children;
}
