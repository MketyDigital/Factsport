import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script"; // 🟢 ADDED NEXT.JS SCRIPT COMPONENT
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer'; 
import SiteHeader from '@/app/components/SiteHeader'; 

export const runtime = 'edge';

const inter = Inter({ subsets: ["latin"] });

// 1. UPDATE METADATA (Manifest, Apple Config & SEO)
export const metadata: Metadata = {
  title: "FactSport | Live Football, Sport News, Predict & Win",
  description: "The #1 Platform for sports updates, predictions, live scores, analysis and breaking news. Join VIP to win monthly prizes.",
  metadataBase: new URL('https://factsport.com'), 
  
  // 🟢 PWA LINKING
  manifest: '/manifest.json',
  
  // 🟢 FIXED ICONS
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/apple-icon.png',
    },
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FactSport',
  },

  openGraph: {
    title: "FactSport - Live Football, Sport News, Predict & Win",
    description: "Latest Sport Updates, Livescores, Watch Football highlights, Live Radio Commentary, Analysis, Predict and win monthly prizes.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'FactSport Logo',
      },
    ],
  },
  robots: "index, follow",
  
  // 🟢 GOOGLE SEARCH CONSOLE VERIFICATION (Required for rapid SEO indexing)
  verification: {
    google: 'YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE', // Replace this later
  },
};

// 2. VIEWPORT EXPORT
export const viewport: Viewport = {
  themeColor: '#0a1428',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, 
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 🟢 GOOGLE ADSENSE AUTO ADS SCRIPT */}
        <Script
          id="adsbygoogle-init"
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6393486260333696"
        />
      </head>
      <body className={`${inter.className} bg-[#F0F2F5] text-slate-900`}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            {/* ✅ HEADER ADDED HERE (Visible on ALL pages) */}
            <SiteHeader /> 
            
            <main className="flex-grow">
              {children}
            </main>
            
            <Footer />
          </div>
        </AuthProvider>

        {/* 🟢 SERVICE WORKER REGISTRATION */}
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
      </body>
    </html>
  );
}