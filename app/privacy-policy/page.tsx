export const runtime = 'edge';
export const metadata = {
  title: 'Privacy Policy | FactSport',
  description: 'How FactSport handles personal information, essential cookies, public editorial content and advertising preferences.',
}

import Link from 'next/link';
import { ChevronLeft, Lock, Eye, Server, Cookie, ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 text-sm font-bold transition">
          <ChevronLeft size={16} /> Back to Home
        </Link>
        <header className="mb-10 border-b border-slate-100 pb-6">
          <h1 className="text-3xl font-black uppercase mb-3 flex items-center gap-3 text-slate-900">
            <Lock className="text-blue-600" size={32} /> Privacy Policy
          </h1>
          <p className="text-slate-500 text-sm">Last updated: 7 November 2026</p>
        </header>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
          <p className="text-lg text-slate-600">
            This policy explains how <strong>FactSport</strong> handles information when visitors use the public football-media website, including news, match information, video embeds and free public features. Separate private products may have their own notices and terms.
          </p>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><Eye size={20} /> 1. Information and purposes</h2>
            <p>Depending on the feature used, information may include account and authentication details, prediction or feature submissions, support correspondence, security and diagnostic data, and technical information such as browser, device, IP address and request logs.</p>
            <p>We use information to operate and secure the service, provide requested features, prevent abuse, maintain records, respond to requests and meet legal obligations. We do not treat a visit to the public media site as consent to marketing.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><Server size={20} /> 2. Service providers and embedded media</h2>
            <p>FactSport uses infrastructure and service providers for hosting, database operations, identity, security, analytics where configured, and delivery of sports or editorial media. Embedded third-party media, such as YouTube players, may collect information under the provider's own privacy terms when loaded or used.</p>
            <p>Where a feature sends information to a provider, that processing is subject to the provider's terms and the applicable configuration of that feature.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><Cookie size={20} /> 3. Cookies, local storage and advertising</h2>
            <p>Essential cookies and storage may be used for security, session continuity, preferences and core site functionality. These are distinct from optional advertising or analytics technologies.</p>
            <p><strong>Google AdSense is not currently enabled on the public V2 website.</strong> If advertising is introduced, the policy and consent experience will be updated before activation. Google and its partners may use cookies, local storage, device identifiers or similar technologies to serve, measure and personalize ads, subject to the user's choices and applicable law.</p>
            <p>For visitors in the European Economic Area, the United Kingdom and Switzerland, personalized Google advertising requires a Google-certified consent management platform integrated with the IAB Transparency and Consent Framework. Ad technology must not be loaded in a way that bypasses applicable consent requirements. The live CMP and its provider list will be identified here before ads are enabled.</p>
            <p>Users will be able to review or change advertising consent choices through the consent controls provided on the site once advertising is activated. Browser settings may also control cookies, although disabling essential storage can affect site functionality.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3">4. Public display and user-generated information</h2>
            <p>Some public features, such as leaderboards or submitted content, may display information according to the rules shown for that feature. Do not submit sensitive personal information in public fields. Private account, payment and communication data must not be included in public editorial pages.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3">5. Retention, security and international processing</h2>
            <p>Information is retained for the period needed to provide the relevant service, protect security, maintain required business records and comply with law. Retention varies by record type. Service providers may process information in countries other than the visitor's country, subject to applicable safeguards and contractual arrangements.</p>
            <p>We use technical and organizational safeguards appropriate to the service, but no internet transmission or storage system can be guaranteed completely secure.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3">6. Your choices and requests</h2>
            <p>Depending on applicable law, you may have rights to request access, correction, deletion, restriction or portability of personal information, and to object to or withdraw consent for optional processing. Requests must be verified before action. Withdrawal does not affect processing already lawfully carried out.</p>
            <p>Use the official contact channel published by FactSport to submit a privacy request. Do not send passwords, payment credentials or identity documents through public social comments.</p>
          </section>

          <section>
            <h2 className="font-bold text-xl text-slate-900 mb-3 flex items-center gap-2"><ShieldCheck size={20} /> 7. Changes to this policy</h2>
            <p>We may update this policy when the service, providers or legal requirements change. The latest revision date appears at the top of this page. Material changes will be communicated through an appropriate site notice where required.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
