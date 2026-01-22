import type { Metadata } from "next";
import "./globals.css";

// This runs on the Edge (Cloudflare)
export const runtime = 'edge';

export const metadata: Metadata = {
  title: "Factsport - Live Predictions & News",
  description: "The #1 African Sports Prediction Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
