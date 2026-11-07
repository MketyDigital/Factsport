export const runtime = 'edge';
export const metadata = {
  title: 'Disclaimer | FactSport',
  description: 'Important information about FactSport public sports coverage, match data and editorial analysis.',
}

import Link from 'next/link';
import { ChevronLeft, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition"><ChevronLeft size={16} /> Back to Home</Link>
        <header className="mb-10 border-b border-slate-100 pb-6">
          <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-slate-900"><ShieldAlert size={32} /> Disclaimer</h1>
          <p className="text-slate-500 text-sm">Public Factsport Media website</p>
        </header>
        <div className="prose prose-slate prose-sm max-w-none space-y-8">
          <section className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
            <h2 className="font-bold text-xl text-blue-900 mb-2 flex items-center gap-2"><Info size={22} /> 1. Sports information only</h2>
            <p className="text-blue-950">The public FactSport Media website provides football and sports news, fixtures, results, live match information, video and editorial analysis. It does not accept wagers, operate a sportsbook or process betting deposits.</p>
          </section>
          <section><h2>2. Match data and editorial accuracy</h2><p>Scores, fixtures, lineups, statistics, commentary and other information may be supplied by external data providers and can be delayed, incomplete or corrected after publication. We work to verify and update information but do not guarantee real-time completeness or absolute accuracy.</p></section>
          <section><h2>3. Editorial analysis</h2><p>Editorial opinions, match previews and statistical analysis are provided for general information. They are not professional, financial, investment or betting advice and should not be relied on as a guarantee of an event's outcome. Prediction entries, wagering and prize campaigns are not features of the public Media website.</p></section>
          <section><h2>4. Advertising and commercial relationships</h2><p>Google AdSense is not currently enabled on the public V2 website. Any future advertising will be identified and implemented subject to applicable publisher policies and privacy requirements. Commercial or affiliate relationships, if introduced to this public site in the future, will be clearly disclosed and will not determine editorial conclusions.</p></section>
          <section><h2>5. Third-party content</h2><p>Links, video embeds and other third-party services are provided for convenience or editorial context. They are controlled by their respective providers and may be subject to separate terms, privacy policies and availability.</p></section>
          <section><h2>6. Separate private services</h2><p>Separate private or premium Factsport products may have distinct features and legal terms. This disclaimer applies only to the public Media website and should not be read as a description of every separately operated service.</p></section>
          <section><h2>7. Responsible use</h2><p>Users are responsible for complying with applicable laws and age requirements when using third-party services. Do not use information on this site as a substitute for professional advice.</p></section>
        </div>
      </div>
    </div>
  );
}
