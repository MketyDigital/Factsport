import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer'; 
import SiteHeader from '@/app/components/SiteHeader'; 


export const runtime = 'edge';

const inter = Inter({ subsets: ["latin"] });

// 1. UPDATE METADATA (Manifest & Apple Config)
export const metadata: Metadata = {
  title: "FactSport | Live Football, Sport News, Predict & Win",
  description: "The #1 Platform for sports updates,predictions, live scores, analysis and breaking news. Join VIP to win monthly prizes.",
  metadataBase: new URL('https://factsport.com'), 
  
  // 🟢 PWA LINKING
  manifest: '/manifest.json',
  
  // 🟢 FIXED ICONS: Pointing explicitly to public folder
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
    description: "Latest Sport Updates, Livescores, Watch Football highlights, Live Radio Commentary, Analysis , Predict and win monthly prizes.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.png', // Uses your logo for social sharing
        width: 1200,
        height: 630,
        alt: 'FactSport Logo',
      },
    ],
  },
  robots: "index, follow",
};

// 2. NEW VIEWPORT EXPORT (Next.js 14 Standard for Theme Color)
export const viewport: Viewport = {
  themeColor: '#0a1428',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevents zooming on input focus (feels more like an app)
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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

        {/* 🟢 SERVICE WORKER REGISTRATION (Safe Static Method) */}
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