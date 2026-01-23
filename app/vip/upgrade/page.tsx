'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Trophy, Check, Copy, CreditCard, Bitcoin, Loader2, ShieldCheck, UploadCloud, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
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
    network: "USDT (TRC20)",
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (hasPending) {
        setUploadError("You already have a pending request. Please wait for approval.");
        return;
    }

    // ... (Keep existing validation logic) ...
    if (!file && !ref) { setUploadError("Please provide Proof."); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) { router.push('/login'); return; }

    let proofUrl = null;

    // ... (Keep existing upload logic) ...
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
             {/* ... (Same Success UI as before) ... */}
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
      {/* ... Header & Benefits (Same as before) ... */}
       {/* (Paste the Header and Benefits section from previous code here) */}
       <div className="relative overflow-hidden bg-black pb-12 pt-10 px-6 rounded-b-[3rem] shadow-2xl border-b border-yellow-900/30">
          {/* ... */}
           <div className="flex flex-col items-center text-center relative z-10">
               <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Join Winners Circle</h1>
           </div>
       </div>

      <div className="max-w-md mx-auto px-4 -mt-8 relative z-10 space-y-6">
        
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
                {/* ... (Paste Payment Toggles & Details Card here) ... */}
                {/* ... (Paste the <form> here) ... */}
                
                {/* Example of where to put the Payment Method Toggle & Form from previous code */}
                {/* Keep all the code exactly as it was, just wrapped in this !hasPending check */}
                
                 {/* --- PAYMENT METHOD TOGGLE --- */}
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setPaymentMethod('bank')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'bank' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}>
                        <CreditCard size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Bank Transfer</span>
                    </button>
                    <button onClick={() => setPaymentMethod('crypto')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'crypto' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}>
                        <Bitcoin size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Crypto</span>
                    </button>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mt-4">
                     <h2 className="text-xl font-black text-center mb-4">{paymentMethod === 'bank' ? BANK_DETAILS.price : CRYPTO_DETAILS.price}</h2>
                     {/* Details... */}
                </div>

                <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl mt-4">
                    <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18} /> Confirm Payment</h3>
                    {uploadError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg text-center">{uploadError}</div>}
                    
                    <div className="space-y-5">
                        <input type="text" placeholder="Ref ID / Name" className="w-full bg-black border border-white/20 rounded-xl py-3.5 px-4 text-white text-sm" value={ref} onChange={(e) => setRef(e.target.value)} />
                        
                        {/* File Input Logic (Same as before) */}
                         <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/20 rounded-xl cursor-pointer">
                            <UploadCloud className="text-slate-500" size={24} />
                            <span className="text-[10px] text-slate-400 mt-1">{file ? file.name : "Upload Proof"}</span>
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                        </label>

                        <button type="submit" disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase py-4 rounded-xl shadow-lg mt-2">
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