import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer'; 
import SiteHeader from '@/app/components/SiteHeader'; 

const inter = Inter({ subsets: ["latin"] });

// 1. UPDATE METADATA (Manifest & Apple Config)
export const metadata: Metadata = {
  title: "FactSport | Live Scores, News & Predict & Win",
  description: "The #1 Platform for sports predictions, live scores, analysis and breaking news. Join VIP to win monthly prizes.",
  metadataBase: new URL('https://factsport.com'), 
  
  // 🟢 PWA LINKING
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FactSport',
  },

  openGraph: {
    title: "FactSport - Predict & Win",
    description: "Watch highlights, get expert tips, and win monthly prizes.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
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