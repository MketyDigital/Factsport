import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer'; 
import SiteHeader from '@/app/components/SiteHeader'; 
import StickyAffiliateBanner from '@/app/components/StickyAffiliateBanner'; 
import CustomVignette from '@/app/components/CustomVignette'; 
import { GlobalMediaProvider } from '@/app/providers/GlobalMediaProvider'; 

export const runtime = 'edge';

const inter = Inter({ subsets: ["latin"] });

// 1. METADATA
export const metadata: Metadata = {
  title: "FactSport | Live Football, Sport News, Predict & Win",
  description: "The #1 Platform for sports updates, predictions, live scores, analysis and breaking news. Join VIP to win monthly prizes.",
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
      <head></head>
      <body className={`${inter.className} bg-[#F0F2F5] text-slate-900`}>
        
        {/* 🟢 THE GLOBAL WRAPPER ENCOMPASSING EVERYTHING */}
        <GlobalMediaProvider>
            
            {/* 🟢 THE AUTH PROVIDER FENCE STARTS HERE */}
            <AuthProvider>
                
                <div className="flex flex-col min-h-screen">
                    <SiteHeader /> 
                    
                    <main className="flex-grow">
                        {children}
                    </main>
                    
                    <Footer />
                </div>

                {/* 🟢 MOVED INSIDE: The Custom Vignette now has access to useAuth! */}
                <CustomVignette />

                {/* 🟢 MOVED INSIDE: Safe in case it ever needs user data later */}
                <StickyAffiliateBanner />
                
            </AuthProvider> 
            {/* 🟢 THE AUTH PROVIDER FENCE ENDS HERE */}

        </GlobalMediaProvider>

        {/* SERVICE WORKER REGISTRATION (Restored for PWA / Add to Home Screen) */}
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