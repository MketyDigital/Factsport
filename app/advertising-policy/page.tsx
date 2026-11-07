export const runtime = 'edge';
export const metadata = {
  title: 'Advertising Policy | FactSport',
  description: 'FactSport public advertising, affiliate disclosure and editorial-independence policy.',
}

import Link from 'next/link';
import { ChevronLeft, ShieldCheck } from 'lucide-react';

export default function AdvertisingPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F0F2F5] p-6 text-slate-800">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ChevronLeft size={16}/> Back to Home</Link>
        <header className="mb-8 border-b border-slate-100 pb-6">
          <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900"><ShieldCheck className="text-blue-600"/> Advertising & Affiliate Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: 7 November 2026</p>
        </header>
        <div className="prose prose-slate max-w-none space-y-6">
          <p>FactSport's public website is an independent football and sports-media experience. Editorial decisions, match reporting and analysis must remain separate from commercial arrangements.</p>
          <section><h2>Current public advertising status</h2><p>Google AdSense is not currently enabled on the public V2 website. No Google ad units are intentionally served by this V2 implementation. The site will not load Google advertising code until the publisher account, domain ownership, site approval, ads.txt, privacy disclosures and required consent controls have been verified.</p></section>
          <section><h2>Affiliate promotions</h2><p>Bookmaker banners, betting bonus codes, betting affiliate links and wagering calls-to-action are not part of the public Factsport Media experience. Private product integrations, if separately operated, are not embedded in public editorial pages, public metadata, public feeds or public social distribution. This separation does not imply that a private product is exempt from applicable laws or platform policies.</p></section>
          <section><h2>Future advertising</h2><p>If advertising is introduced, it will be clearly distinguishable from editorial content and navigation. Ad placements will not be designed to encourage accidental clicks, obscure content, interrupt access to sports information or sit beside match controls, forms, predictions or other interactive elements. Ad units will not be automatically refreshed.</p></section>
          <section><h2>Privacy and consent</h2><p>Advertising technologies may use cookies, local storage or similar identifiers. They will only be activated after the applicable privacy disclosures, user choices and consent-management requirements are implemented. For personalized Google ads in the EEA, UK and Switzerland, a Google-certified CMP integrated with the IAB TCF is required.</p></section>
          <section><h2>Editorial independence</h2><p>Advertising does not purchase favorable coverage or influence editorial conclusions. Sponsored or commercially supported material, if ever accepted, must be clearly identified and reviewed separately from independent journalism.</p></section>
          <section><h2>Questions or corrections</h2><p>For questions about a specific public placement, use the official FactSport contact channels linked in the site footer. Do not send account passwords or payment details through social media.</p></section>
        </div>
      </article>
    </main>
  );
}
