import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VIP Membership | FactSport',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

export default function VipUpgradeLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
