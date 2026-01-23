import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/app/components/AuthProvider";
import Footer from '@/app/components/Footer'; // ✅ Added Footer

const inter = Inter({ subsets: ["latin"] });

// ✅ Improved SEO Metadata
export const metadata: Metadata = {
  title: "FactSport | Live Scores, News & Predictions",
  description: "The #1 Platform for sports predictions, live scores, and breaking news. Join VIP to win monthly prizes.",
  metadataBase: new URL('https://factsport.com'), // Replace with your actual Vercel domain later
  openGraph: {
    title: "FactSport - Predict & Win",
    description: "Watch highlights, get expert tips, and win monthly prizes.",
    siteName: 'FactSport',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap everything inside AuthProvider */}
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow">
              {children}
            </main>
            <Footer /> {/* ✅ Footer added here */}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}