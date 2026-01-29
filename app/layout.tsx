import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
// ❌ REMOVED: import Footer from '@/app/components/Footer'; (We are hardcoding it below for Google)

const inter = Inter({ subsets: ["latin"] });

// ✅ Improved SEO Metadata with Robots tag for Google
export const metadata: Metadata = {
  title: "FactSport | Live Scores, News & Predictions",
  description: "The #1 Platform for sports predictions, live scores, and breaking news. Join VIP to win monthly prizes.",
  metadataBase: new URL('https://factsport.com'), 
  openGraph: {
    title: "FactSport - Predict & Win",
    description: "Watch highlights, get expert tips, and win monthly prizes.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
  },
  robots: "index, follow", // ✅ CRITICAL for Verification
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F0F2F5] text-slate-900`}>
        {/* Wrap everything inside AuthProvider to keep Login working */}
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            
            {/* MAIN CONTENT */}
            <main className="flex-grow">
              {children}
            </main>

            {/* ✅ GLOBAL COMPLIANCE FOOTER (Hardcoded here for Google Visibility) */}
            <footer className="bg-[#0a1428] text-slate-400 py-8 border-t border-white/10 mt-auto">
              <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                
                {/* Brand */}
                <div>
                   <h2 className="text-white font-black tracking-tighter text-lg">FactSport</h2>
                   <p className="text-[10px] text-slate-500 mt-1">© 2026 FactSport Enterprise. All rights reserved.</p>
                </div>

                {/* ✅ THE LINKS GOOGLE WANTS (Standard HTML Tags for instant visibility) */}
                <div className="flex flex-wrap justify-center gap-6 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <a href="/privacy-policy" className="hover:text-white transition">Privacy Policy</a>
                    <a href="/terms" className="hover:text-white transition">Terms of Service</a>
                    <a href="/disclaimer" className="hover:text-white transition">Disclaimer</a>
                </div>

              </div>
            </footer>

          </div>
        </AuthProvider>
      </body>
    </html>
  );
}