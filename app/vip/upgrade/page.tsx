'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { 
  Trophy, Check, Copy, CreditCard, Bitcoin, Loader2, ShieldCheck, 
  UploadCloud, Image as ImageIcon, X, AlertCircle, 
  Gift, MessageCircle, Ticket, TrendingUp, Tv 
} from 'lucide-react';
import Link from 'next/link';

export default function VipUpgradePage() {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
   
  // States for Logic
  const [isVip, setIsVip] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [vipExpiry, setVipExpiry] = useState<string | null>(null);

  // Form States
  const [copied, setCopied] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'crypto'>('bank');
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
   
  const router = useRouter();
  const supabase = createClient();

  // --- CONFIG ---
  const BANK_DETAILS = {
    bankName: "Opay / Paycom",
    accountNumber: "9012345678",
    accountName: "FactSport Enterprise",
    price: "₦5,000"
  };
  const CRYPTO_DETAILS = {
    network: "Bitcoin / USDT (TRC20)",
    address: "TWe7....(Your Wallet)...",
    price: "$5.00"
  };

  // 1. SMART CHECK ON LOAD
  useEffect(() => {
    const checkStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check Profile for VIP Status
      const { data: profile } = await supabase.from('profiles').select('is_vip, vip_expires_at').eq('id', session.user.id).single();
      
      // Check for Pending Requests
      const { data: pending } = await supabase.from('subscriptions').select('id').eq('user_id', session.user.id).eq('status', 'pending').single();

      if (profile?.is_vip) {
          setIsVip(true);
          setVipExpiry(profile.vip_expires_at);
      }
      
      if (pending) {
          setHasPending(true);
      }

      setCheckingStatus(false);
    };
    checkStatus();
  }, [supabase]);

  // Helper: Copy Text
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (hasPending) {
        setUploadError("You already have a pending request. Please wait for approval.");
        return;
    }

    if (!file && !ref) { setUploadError("Please provide Proof."); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) { router.push('/login'); return; }

    let proofUrl = null;

    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('payment_proofs').upload(fileName, file);
        if (uploadErr) { setUploadError(`Upload Failed: ${uploadErr.message}`); setLoading(false); return; }
        const { data: publicUrlData } = supabase.storage.from('payment_proofs').getPublicUrl(fileName);
        proofUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'monthly',
        amount: paymentMethod === 'bank' ? 5000 : 5,
        payment_method: paymentMethod,
        transaction_ref: ref || 'Screenshot Uploaded',
        proof_url: proofUrl,
        status: 'pending'
    });

    if (!error) {
        setSuccess(true);
        setHasPending(true); // Prevent double submit instantly
    } else {
        setUploadError(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // --- VIEW 1: ALREADY VIP ---
  if (!checkingStatus && isVip) {
    return (
        <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 border border-yellow-500 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <Trophy size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">VIP Active</h1>
                <p className="text-yellow-100 font-medium mb-6">
                    You are already a member of the Winners Circle.
                </p>
                <div className="bg-black/20 rounded-xl p-4 mb-6">
                    <p className="text-[10px] text-yellow-200 uppercase font-bold">Expires On</p>
                    <p className="text-xl font-mono font-bold text-white">
                        {vipExpiry ? new Date(vipExpiry).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Lifetime'}
                    </p>
                </div>
                <Link href="/dashboard" className="block w-full bg-white text-yellow-800 font-black py-4 rounded-xl shadow-lg hover:bg-slate-100 transition">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
  }

  // --- VIEW 2: SUCCESS MESSAGE ---
  if (success) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-yellow-500/30 p-8 rounded-2xl text-center max-w-md w-full">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Request Submitted</h2>
                <p className="text-slate-400 text-sm mb-6">Verification in progress. Check back soon.</p>
                <button onClick={() => router.push('/dashboard')} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl">Back to Dashboard</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1428] pb-24 font-sans text-white">
       
       {/* HEADER */}
       <div className="relative overflow-hidden bg-black pb-12 pt-10 px-6 rounded-b-[3rem] shadow-2xl border-b border-yellow-900/30">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
            <div className="flex flex-col items-center text-center relative z-10">
                <div className="bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-4 animate-pulse">Premium Access</div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Predict & Win</h1>
                <p className="text-slate-400 text-sm mt-2 max-w-xs">Join the Winners Circle. Get exclusive access and win real prizes.</p>
            </div>
       </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-10 space-y-6">
        
        {/* --- BENEFITS GRID (NEW) --- */}
        <div className="grid grid-cols-2 gap-3">
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-yellow-500/10 rounded-full flex items-center justify-center mb-2"><Trophy size={16} className="text-yellow-500"/></div>
                 <h3 className="text-xs font-bold text-white">Monthly Cash Prizes</h3>
             </div>
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center mb-2"><Gift size={16} className="text-blue-500"/></div>
                 <h3 className="text-xs font-bold text-white">Win Sport Items</h3>
             </div>
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center mb-2"><MessageCircle size={16} className="text-green-500"/></div>
                 <h3 className="text-xs font-bold text-white">VIP Telegram Access</h3>
             </div>
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-purple-500/10 rounded-full flex items-center justify-center mb-2"><Ticket size={16} className="text-purple-500"/></div>
                 <h3 className="text-xs font-bold text-white">Accurate Betting Codes</h3>
             </div>
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-red-500/10 rounded-full flex items-center justify-center mb-2"><TrendingUp size={16} className="text-red-500"/></div>
                 <h3 className="text-xs font-bold text-white">Premium Analysis</h3>
             </div>
             <div className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl flex flex-col items-center text-center">
                 <div className="w-8 h-8 bg-orange-500/10 rounded-full flex items-center justify-center mb-2"><Tv size={16} className="text-orange-500"/></div>
                 <h3 className="text-xs font-bold text-white">Live Match Watch</h3>
             </div>
        </div>

        {/* --- PENDING WARNING (Anti-Spam) --- */}
        {hasPending && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 p-6 rounded-2xl text-center backdrop-blur-md">
                <Loader2 size={32} className="text-yellow-500 mx-auto mb-3 animate-spin" />
                <h3 className="font-black text-yellow-500 text-lg uppercase">Verification in Progress</h3>
                <p className="text-xs text-slate-300 mt-2 mb-4">
                    You already have a request submitted. Please allow up to 30 minutes for admin approval.
                </p>
                <Link href="/dashboard" className="inline-block bg-yellow-500 text-black font-bold text-xs px-6 py-2 rounded-full">
                    Return to Dashboard
                </Link>
            </div>
        )}

        {/* --- FORM (Only show if NO pending request) --- */}
        {!hasPending && (
            <>
                {/* --- PAYMENT METHOD TOGGLE --- */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <button onClick={() => setPaymentMethod('bank')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'bank' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}>
                        <CreditCard size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Bank Transfer</span>
                    </button>
                    <button onClick={() => setPaymentMethod('crypto')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'crypto' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}>
                        <Bitcoin size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Crypto</span>
                    </button>
                </div>

                {/* --- PAYMENT DETAILS CARD --- */}
                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                     {/* Background Glow */}
                     <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none"></div>
                     
                     <div className="text-center mb-6">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Amount to Pay</span>
                        <h2 className="text-3xl font-black text-white mt-1">{paymentMethod === 'bank' ? BANK_DETAILS.price : CRYPTO_DETAILS.price}</h2>
                     </div>

                     <div className="space-y-4">
                        {paymentMethod === 'bank' ? (
                            <>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-xs text-slate-400">Bank Name</span>
                                    <span className="text-sm font-bold text-white">{BANK_DETAILS.bankName}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-xs text-slate-400">Account Name</span>
                                    <span className="text-sm font-bold text-white text-right">{BANK_DETAILS.accountName}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 mb-1 block">Account Number</span>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black border border-white/20 rounded-lg p-3 font-mono font-bold text-lg text-yellow-500 tracking-wider">
                                            {BANK_DETAILS.accountNumber}
                                        </div>
                                        <button 
                                            onClick={() => handleCopy(BANK_DETAILS.accountNumber)}
                                            className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-lg transition"
                                        >
                                            {copied === BANK_DETAILS.accountNumber ? <Check size={20} className="text-green-500"/> : <Copy size={20}/>}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg mb-4">
                                     <p className="text-[10px] text-yellow-200 text-center font-bold">
                                        ⚠️ Please ensure you send ONLY <br/> {CRYPTO_DETAILS.network}
                                     </p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 mb-1 block">Wallet Address ({CRYPTO_DETAILS.network})</span>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black border border-white/20 rounded-lg p-3 font-mono text-xs text-slate-300 break-all flex items-center">
                                            {CRYPTO_DETAILS.address}
                                        </div>
                                        <button 
                                            onClick={() => handleCopy(CRYPTO_DETAILS.address)}
                                            className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-lg transition h-full"
                                        >
                                            {copied === CRYPTO_DETAILS.address ? <Check size={20} className="text-green-500"/> : <Copy size={20}/>}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                     </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18} /> Confirm Payment</h3>
                    {uploadError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg text-center">{uploadError}</div>}
                    
                    <div className="space-y-5">
                        <input type="text" placeholder={paymentMethod === 'bank' ? "Sender Name / Ref ID" : "Transaction Hash / ID"} className="w-full bg-black border border-white/20 rounded-xl py-3.5 px-4 text-white text-sm focus:border-yellow-500 outline-none transition" value={ref} onChange={(e) => setRef(e.target.value)} />
                        
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-yellow-500/50 hover:bg-white/5 transition group">
                            <UploadCloud className="text-slate-500 group-hover:text-yellow-500 transition" size={24} />
                            <span className="text-[10px] text-slate-400 mt-2 font-medium">{file ? file.name : "Tap to Upload Screenshot"}</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                        </label>

                        <button type="submit" disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase py-4 rounded-xl shadow-lg mt-2 transition active:scale-95">
                            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Submit Payment"}
                        </button>
                    </div>
                </form>
            </>
        )}
      </div>
    </div>
  );
}