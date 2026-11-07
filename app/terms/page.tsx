export const runtime = 'edge';
export const metadata = {
  title: 'Terms of Service | FactSport',
  description: 'Terms governing use of the public FactSport football-media website.',
}

import Link from 'next/link';
import { ChevronLeft, BookOpen } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition"><ChevronLeft size={16} /> Back to Home</Link>
        <header className="mb-10 border-b border-slate-100 pb-6">
          <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-slate-900"><BookOpen className="text-blue-600" size={32} /> Terms of Service</h1>
          <p className="text-slate-500 text-sm">Last updated: 7 November 2026</p>
        </header>
        <div className="prose prose-slate prose-sm max-w-none space-y-8">
          <p className="lead text-lg text-slate-600">These terms govern your use of the public FactSport football-media website, including sports news, match information, editorial analysis, video and other public media features.</p>
          <section><h2>1. Public media service</h2><p>FactSport provides sports information and media content for general information and entertainment. Match schedules, live scores, statistics and other provider-supplied information may be delayed, corrected or unavailable. We do not guarantee that data is complete or error-free.</p></section>
          <section><h2>2. Acceptable use</h2><p>You must use the service lawfully. You must not interfere with the website, attempt unauthorized access, misuse public forms or endpoints, distribute malware or spam, harass others, or infringe intellectual-property or privacy rights.</p></section>
          <section><h2>3. Editorial content and intellectual property</h2><p>FactSport publishes editorial material and sports information. Third-party names, marks, logos, photographs, video and embedded material remain subject to their respective rights. You may not reproduce or commercially exploit FactSport content without permission or another valid legal basis.</p><p>Where third-party media is embedded, your use of that media may also be governed by the provider's terms.</p></section>
          <section><h2>4. Public Media features</h2><p>Public Media features include editorial content, sports information, match data and media playback. Prediction entries, premium memberships, payment services and prize campaigns are not part of this public Media service. Any separately operated Prediction product is governed by its own terms, eligibility requirements and notices.</p></section>
          <section><h2>5. Separate products</h2><p>Private, premium, subscription, payment, campaign or other separately operated Factsport products are not governed by this public-media terms page. Access to those services, if offered, is subject to their own terms, eligibility requirements and notices presented within the relevant product. This clause does not change or cancel existing obligations.</p></section>
          <section><h2>6. Third-party services</h2><p>The public website may link to or embed third-party services. We do not control their availability, content or privacy practices. Their own terms and notices apply when you use them.</p></section>
          <section><h2>7. Availability and liability</h2><p>The public website is provided subject to applicable law. We may update, suspend or correct content and functionality. Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded.</p></section>
          <section><h2>8. Changes</h2><p>We may update these terms as the public service changes. The revision date above identifies the current version. Continued use after an update constitutes acceptance where permitted by applicable law.</p></section>
        </div>
      </div>
    </div>
  );
}
