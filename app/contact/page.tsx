export const runtime = 'edge';
export const metadata = {
  title: 'Contact FactSport | Official Channels',
  description: 'Contact FactSport through its official social and publishing channels.',
}

import Link from 'next/link';
import { ChevronLeft, Facebook, Instagram, Youtube, Send, MessageCircle } from 'lucide-react';

const channels = [
  { label: 'Facebook — FactSport Live', href: 'https://facebook.com/factsportlive', icon: Facebook },
  { label: 'Facebook — FactSport Football', href: 'https://facebook.com/Factsportfootball', icon: Facebook },
  { label: 'Instagram', href: 'https://instagram.com/factsportlive', icon: Instagram },
  { label: 'X', href: 'https://x.com/factsportlive', icon: MessageCircle },
  { label: 'Telegram', href: 'https://t.me/Factsportlive', icon: Send },
  { label: 'YouTube', href: 'https://youtube.com/@factsportlive', icon: Youtube },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#F0F2F5] p-6 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ChevronLeft size={16}/> Back to Home</Link>
        <h1 className="text-3xl font-black text-slate-900">Contact FactSport</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">For general questions, editorial feedback or correction requests, use one of the official FactSport channels below. Please identify the article or match you are asking about and provide a public source where relevant.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {channels.map(channel => {
            const Icon = channel.icon;
            return <a key={channel.href + channel.label} href={channel.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50">
              <Icon size={18} className="text-blue-600"/>{channel.label}
            </a>;
          })}
        </div>
        <p className="mt-8 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">For your security, do not post passwords, payment information, identity documents or private account details in public comments. Use the relevant private product support process for account or payment matters.</p>
      </article>
    </main>
  );
}
