'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Trophy, Check, Copy, CreditCard, Bitcoin, Loader2, ShieldCheck, 
  UploadCloud, AlertCircle, Gift, MessageCircle, Ticket, 
  TrendingUp, Tv, ExternalLink, Mail, Send, Lock
} from 'lucide-react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';

export default function VipUpgradePage() {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
   
  // States for Logic
  const [isVip, setIsVip] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [vipExpiry, setVipExpiry] = useState<string | null>(null);

  // Form States
  const [copied, setCopied] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'gateway' | 'crypto'>('crypto');
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
   
  const router = useRouter();
  const supabase = createClient();

  const [gatewayDetails, setGatewayDetails] = useState({ link: "", price: "$5.00" });
  const [cryptoDetails, setCryptoDetails] = useState({ network: "USDT/Bitcoin (TRC20)", address: "TRVBw6ZzVnnzfSMSPkyGrRjVpqH9C7wcr2", price: "$5.00" });
  const [supportDetails, setSupportDetails] = useState({ telegram: "https://t.me/factsportlive", email: "support@factsport.com" });

  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: settings } = await supabase.from('site_settings').select('*').eq('id', 1).single();
      if (settings) {
          setGatewayDetails({
              link: settings.gateway_link || "",
              price: "$5.00" 
          });
          setCryptoDetails({
              network: settings.crypto_network || "USDT/Bitcoin (TRC20)",
              address: settings.crypto_address || "TRVBw6ZzVnnzfSMSPkyGrRjVpqH9C7wcr2",
              price: "$5.00"
          });
          if (settings.telegram_support) {
              setSupportDetails(prev => ({ ...prev, telegram: settings.telegram_support }));
          }
          
          if (!settings.gateway_link) setPaymentMethod('crypto');
      }

      if (!session) return;

      const { data: profile } = await supabase.from('profiles').select('is_vip, vip_expires_at').eq('id', session.user.id).single();
      const { data: pending } = await supabase.from('subscriptions').select('id').eq('user_id', session.user.id).eq('status', 'pending').single();

      if (profile?.is_vip) { setIsVip(true); setVipExpiry(profile.vip_expires_at); }
      if (pending) { setHasPending(true); }

      setCheckingStatus(false);
    };
    initData();
  }, [supabase]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (paymentMethod === 'gateway' && !gatewayDetails.link) return;

    if (hasPending) {
        setUploadError("You already have a pending request. Please wait for approval.");
        return;
    }

    if (!file && !ref) { setUploadError("Please provide Proof of payment or Transaction ID."); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) { router.push('/login'); return; }

    let proofUrl = null;

    if (file) {
        try {
            const options = {
                maxSizeMB: 0.2, 
                maxWidthOrHeight: 1200, 
                useWebWorker: true
            };
            
            const compressedFile = await imageCompression(file, options);

            const fileExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'img';
            const fileName = `proof-${user.id}-${Date.now()}.${fileExt}`;
            
            const { error: uploadErr } = await supabase.storage.from('payment_proofs').upload(fileName, compressedFile);
            if (uploadErr) { setUploadError(`Upload Failed: ${uploadErr.message}`); setLoading(false); return; }
            
            const { data: publicUrlData } = supabase.storage.from('payment_proofs').getPublicUrl(fileName);
            proofUrl = publicUrlData.publicUrl;
            
        } catch (compressionErr: any) {
            console.error('Compression error:', compressionErr);
            setUploadError("Failed to process image. Please try another screenshot.");
            setLoading(false);
            return;
        }
    }

    const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'monthly',
        amount: 5, 
        payment_method: paymentMethod,
        transaction_ref: ref || 'Screenshot Uploaded',
        proof_url: proofUrl,
        status: 'pending'
    });

    if (!error) {
        setSuccess(true);
        setHasPending(true); 
    } else {
        setUploadError(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  if (!checkingStatus && isVip) {
    return (
        <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4 selection:bg-yellow-500">
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-700 border border-yellow-400 p-10 rounded-3xl text-center max-w-md w-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-20 rounded-full blur-3xl transform translate-x-20 -translate-y-20"></div>
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                    <Trophy size={48} className="text-white drop-shadow-md" />
                </div>
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-md">VIP Active</h1>
                <p className="text-yellow-100 font-bold mb-8 text-sm">
                    You are officially in the Winners Circle.
                </p>
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-5 mb-8 border border-white/10 shadow-inner">
                    <p className="text-[10px] text-yellow-300 uppercase font-black tracking-widest mb-1">Status Valid Until</p>
                    <p className="text-2xl font-mono font-black text-white">
                        {vipExpiry ? new Date(vipExpiry).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Lifetime Access'}
                    </p>
                </div>
                <Link href="/dashboard" className="block w-full bg-white text-yellow-900 font-black uppercase tracking-widest py-4 rounded-xl shadow-xl hover:scale-105 transition-transform">
                    Enter Dashboard
                </Link>
            </div>
        </div>
    );
  }

  if (success) {
    return (
        <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
            <div className="bg-[#0f1c3a] border border-green-500/30 p-10 rounded-3xl text-center max-w-md w-full shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-green-500/5"></div>
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)] relative z-10">
                    <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-black text-white mb-3 relative z-10 tracking-tight">Request Received</h2>
                <p className="text-slate-400 text-sm mb-8 font-medium relative z-10">Your proof of payment is being verified by our team. Approval usually takes less than 30 minutes.</p>
                <button onClick={() => router.push('/dashboard')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg transition active:scale-95 relative z-10">
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1428] pb-24 font-sans text-white selection:bg-yellow-500">
       
       <div className="relative overflow-hidden bg-black pb-16 pt-12 px-6 rounded-b-[3rem] shadow-2xl border-b border-yellow-500/30">
            <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="flex flex-col items-center text-center relative z-10">
                <div className="bg-yellow-500 text-black text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center gap-1.5">
                    <Lock size={12}/> Premium Access
                </div>
                <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">Join The <span className="text-yellow-500">Winners Circle</span></h1>
                <p className="text-slate-300 text-sm md:text-base mt-4 max-w-md font-medium leading-relaxed">Unlock guaranteed slips, pro-level AI analysis, and compete for millions in monthly cash prizes.</p>
            </div>
       </div>

      <div className="max-w-xl mx-auto px-4 -mt-8 relative z-20 space-y-6">
        
        {/* PREMIUM BENEFITS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
             <div className="bg-[#0f1c3a] border border-white/5 p-4 md:p-5 rounded-2xl flex flex-col items-center text-center shadow-lg group hover:border-yellow-500/30 transition-colors">
                 <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Trophy size={18} className="text-yellow-500"/></div>
                 <h3 className="text-xs font-black text-white mb-1 tracking-wide">Cash Prizes</h3>
                 <p className="text-[9px] text-slate-400 font-medium">Top the leaderboard for real rewards.</p>
             </div>
             <div className="bg-[#0f1c3a] border border-white/5 p-4 md:p-5 rounded-2xl flex flex-col items-center text-center shadow-lg group hover:border-blue-500/30 transition-colors">
                 <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><MessageCircle size={18} className="text-blue-500"/></div>
                 <h3 className="text-xs font-black text-white mb-1 tracking-wide">VIP Telegram</h3>
                 <p className="text-[9px] text-slate-400 font-medium">Private community of winners.</p>
             </div>
             <div className="bg-[#0f1c3a] border border-white/5 p-4 md:p-5 rounded-2xl flex flex-col items-center text-center shadow-lg group hover:border-purple-500/30 transition-colors">
                 <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Ticket size={18} className="text-purple-500"/></div>
                 <h3 className="text-xs font-black text-white mb-1 tracking-wide">Accurate Slips</h3>
                 <p className="text-[9px] text-slate-400 font-medium">High-odds accumulators daily.</p>
             </div>
             <div className="bg-[#0f1c3a] border border-white/5 p-4 md:p-5 rounded-2xl flex flex-col items-center text-center shadow-lg group hover:border-red-500/30 transition-colors">
                 <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><TrendingUp size={18} className="text-red-500"/></div>
                 <h3 className="text-xs font-black text-white mb-1 tracking-wide">Pro Analysis</h3>
                 <p className="text-[9px] text-slate-400 font-medium">AI-driven betting insights.</p>
             </div>
             <div className="bg-[#0f1c3a] border border-white/5 p-4 md:p-5 rounded-2xl flex flex-col items-center text-center shadow-lg group hover:border-emerald-500/30 transition-colors md:col-span-2">
                 <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Gift size={18} className="text-emerald-500"/></div>
                 <h3 className="text-xs font-black text-white mb-1 tracking-wide">Official Merchandise</h3>
                 <p className="text-[9px] text-slate-400 font-medium">Win authentic jerseys and gear.</p>
             </div>
        </div>

        {hasPending && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 p-8 rounded-3xl text-center backdrop-blur-md shadow-xl">
                <Loader2 size={40} className="text-yellow-500 mx-auto mb-4 animate-spin" />
                <h3 className="font-black text-yellow-500 text-xl uppercase tracking-tighter">Verification in Progress</h3>
                <p className="text-sm text-slate-300 mt-2 mb-6 font-medium">
                    You already have a request submitted. Please allow up to 30 minutes for admin approval.
                </p>
                <Link href="/dashboard" className="inline-block bg-yellow-500 text-black font-black uppercase tracking-widest text-[10px] px-8 py-3 rounded-xl shadow-lg hover:bg-yellow-400 transition">
                    Return to Dashboard
                </Link>
            </div>
        )}

        {!hasPending && (
            <div className="bg-[#0f1c3a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                <h2 className="text-lg font-black uppercase tracking-widest text-center mb-6 flex items-center justify-center gap-2">
                    <CreditCard className="text-blue-500"/> Select Payment
                </h2>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button onClick={() => setPaymentMethod('gateway')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${paymentMethod === 'gateway' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'}`}>
                        <CreditCard size={28} /><span className="text-[10px] font-black uppercase tracking-widest">Card / Bank</span>
                    </button>
                    <button onClick={() => setPaymentMethod('crypto')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all active:scale-95 ${paymentMethod === 'crypto' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'}`}>
                        <Bitcoin size={28} /><span className="text-[10px] font-black uppercase tracking-widest">Crypto</span>
                    </button>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-6 shadow-inner relative overflow-hidden mb-8">
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none"></div>
                      
                      <div className="text-center mb-6">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">VIP Monthly Pass</span>
                        <h2 className="text-4xl font-black text-white">{paymentMethod === 'gateway' ? gatewayDetails.price : cryptoDetails.price}</h2>
                      </div>

                      <div className="space-y-4">
                        {paymentMethod === 'gateway' ? (
                            gatewayDetails.link ? (
                                <div className="text-center">
                                    <p className="text-xs text-slate-300 mb-5 leading-relaxed font-medium">
                                        Click below to pay securely via our global payment partner. 
                                        <strong className="text-white block mt-1">Save your receipt screenshot after payment!</strong>
                                    </p>
                                    <a 
                                        href={gatewayDetails.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="w-full inline-flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest px-6 py-4 rounded-xl shadow-lg transition active:scale-95"
                                    >
                                        Proceed to Payment <ExternalLink size={16} />
                                    </a>
                                </div>
                            ) : (
                                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl text-center">
                                    <AlertCircle className="text-red-500 mx-auto mb-2" size={28} />
                                    <h4 className="text-sm font-black text-red-400 uppercase tracking-wider mb-1">Gateway Offline</h4>
                                    <p className="text-[10px] text-red-200/70 font-medium leading-relaxed">
                                        Card payments are currently unavailable. Please select the <strong>Crypto</strong> option above to complete your upgrade.
                                    </p>
                                </div>
                            )
                        ) : (
                            <>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl mb-4 text-center">
                                     <p className="text-[10px] text-yellow-200 font-bold uppercase tracking-widest">
                                        ⚠️ Send ONLY <span className="text-yellow-500 font-black">{cryptoDetails.network}</span>
                                     </p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 mb-1.5 block uppercase tracking-widest">Wallet Address</span>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black border border-white/10 rounded-xl p-3.5 font-mono text-xs text-white break-all flex items-center shadow-inner">
                                            {cryptoDetails.address}
                                        </div>
                                        <button 
                                            onClick={() => handleCopy(cryptoDetails.address)}
                                            className="bg-white/10 hover:bg-white/20 text-white p-3.5 rounded-xl transition shadow-md shrink-0 flex items-center justify-center w-14"
                                        >
                                            {copied === cryptoDetails.address ? <Check size={20} className="text-green-500"/> : <Copy size={20}/>}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                      </div>
                </div>

                <form onSubmit={handleSubmit} className="border-t border-white/10 pt-8">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
                        <ShieldCheck className="text-green-500" size={20} /> Verify Payment
                    </h3>
                    
                    {uploadError && <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl text-center shadow-sm">{uploadError}</div>}
                    
                    <div className="space-y-5">
                        <input 
                            type="text" 
                            disabled={paymentMethod === 'gateway' && !gatewayDetails.link}
                            placeholder="Enter Transaction ID or Ref..." 
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white text-sm font-mono focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition disabled:opacity-50" 
                            value={ref} 
                            onChange={(e) => setRef(e.target.value)} 
                        />
                        
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl transition group ${paymentMethod === 'gateway' && !gatewayDetails.link ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-yellow-500 hover:bg-white/5 bg-black/20'}`}>
                            <UploadCloud className={`transition mb-2 ${paymentMethod === 'gateway' && !gatewayDetails.link ? 'text-slate-600' : 'text-slate-400 group-hover:text-yellow-500 group-hover:-translate-y-1'}`} size={32} />
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full">
                                {file ? file.name : "Upload Screenshot (Required)"}
                            </span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                disabled={paymentMethod === 'gateway' && !gatewayDetails.link}
                                onChange={(e) => e.target.files && setFile(e.target.files[0])} 
                            />
                        </label>

                        <button 
                            type="submit" 
                            disabled={loading || (paymentMethod === 'gateway' && !gatewayDetails.link)} 
                            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black uppercase tracking-widest py-4 md:py-5 rounded-xl shadow-[0_10px_20px_rgba(234,179,8,0.3)] mt-4 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><ShieldCheck size={20}/> Submit Verification</>}
                        </button>
                    </div>
                </form>
            </div>
        )}

        <div className="mt-8 text-center pb-8">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Need Help With Payment?</h4>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href={`mailto:${supportDetails.email}`} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition w-full sm:w-auto shadow-sm">
                    <Mail size={14} className="text-blue-400" /> Support Email
                </a>
                <a href={supportDetails.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#229ED9] transition w-full sm:w-auto shadow-sm">
                    <Send size={14} /> Telegram Chat
                </a>
            </div>
        </div>

      </div>
    </div>
  );
}