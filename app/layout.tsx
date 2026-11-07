import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer';
import SiteHeader from '@/app/components/SiteHeader';
import StickyAffiliateBanner from '@/app/components/StickyAffiliateBanner';
import { GlobalMediaProvider } from '@/app/providers/GlobalMediaProvider';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FactSport | Live Football, Sports News & Analysis",
  description: "Football news, live scores, fixtures, match analysis and highlights from leagues around the world.",
  metadataBase: new URL('https://factsport.com'),
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FactSport',
  },
  openGraph: {
    title: "FactSport - Live Football, Sports News & Analysis",
    description: "Latest football news, live scores, fixtures, match highlights and independent match analysis.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'FactSport Logo' }],
  },
  robots: "index, follow",
};

export const viewport: Viewport = {
  themeColor: '#0a1428',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const configuredPrivateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
    .split(',')[0].trim().toLowerCase().split(':')[0];
  const isPrivateProductHost = !!configuredPrivateHost && requestHost === configuredPrivateHost;

  const publicMediaShell = (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-grow">{children}</main>
      <Footer />
      <StickyAffiliateBanner />
    </div>
  );

  const application = isPrivateProductHost
    ? children
    : process.env.NODE_ENV === 'development'
      ? <AuthProvider>{publicMediaShell}</AuthProvider>
      : publicMediaShell;

  return (
    <html lang="en">
      <head></head>
      <body className={`${inter.className} bg-[#F0F2F5] text-slate-900`}>
        {isPrivateProductHost ? application : <GlobalMediaProvider>{application}</GlobalMediaProvider>}
        {!isPrivateProductHost && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js');
                  });
                }
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
