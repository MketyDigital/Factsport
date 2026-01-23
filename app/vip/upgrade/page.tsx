'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Trophy, Check, Copy, CreditCard, Bitcoin, Loader2, ShieldCheck, UploadCloud, Image as ImageIcon, X } from 'lucide-react';

export default function VipUpgradePage() {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'crypto'>('bank');
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // --- 🔧 CONFIGURATION ---
  const BANK_DETAILS = {
    bankName: "Opay / Paycom",
    accountNumber: "9012345678",
    accountName: "FactSport Enterprise",
    price: "₦5,000"
  };

  const CRYPTO_DETAILS = {
    network: "USDT (TRC20)",
    address: "TWe7....(Your Wallet Address)...",
    price: "$5.00"
  };
  // -------------------------

  // Check Login Status on Load
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Optional: you can redirect here if you want strict enforcement
        // router.push('/login'); 
      }
    };
    checkUser();
  }, [supabase, router]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const selected = e.target.files[0];
        
        // Validation: Max 5MB
        if (selected.size > 5 * 1024 * 1024) { 
            setUploadError("File too large (Max 5MB)");
            return;
        }
        
        setFile(selected);
        setUploadError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    // 1. Validation
    if (!file && !ref) {
        setUploadError("Please provide a Screenshot OR a Reference ID.");
        return;
    }
    setLoading(true);

    // 2. Check Session
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        alert("You must be logged in to submit a payment.");
        router.push('/login');
        return;
    }

    let proofUrl = null;

    // 3. Upload Image (If exists)
    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
            .from('payment_proofs')
            .upload(fileName, file);

        if (uploadErr) {
            setUploadError(`Upload Failed: ${uploadErr.message}`);
            setLoading(false);
            return;
        }
        
        const { data: publicUrlData } = supabase.storage
            .from('payment_proofs')
            .getPublicUrl(fileName);
            
        proofUrl = publicUrlData.publicUrl;
    }

    // 4. Insert Request into Database
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
    } else {
        // ✅ SHOW REAL ERROR MESSAGE FOR DEBUGGING
        console.error("DB Error:", error);
        setUploadError(`Database Error: ${error.message} (Code: ${error.code})`);
    }
    setLoading(false);
  };

  if (success) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-yellow-500/30 p-8 rounded-2xl text-center max-w-md w-full">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Proof Received!</h2>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Our team will verify your transaction shortly. Your account will be upgraded within <span className="text-white font-bold">30 minutes</span>.
                </p>
                <button onClick={() => router.push('/dashboard')} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1428] pb-24 font-sans text-white">
      
      {/* --- HEADER --- */}
      <div className="relative overflow-hidden bg-black pb-12 pt-10 px-6 rounded-b-[3rem] shadow-2xl border-b border-yellow-900/30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-600 rounded-full blur-[120px] opacity-20"></div>
        <div className="flex flex-col items-center text-center relative z-10">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.4)] mb-5">
                <Trophy className="text-black fill-black" size={32} />
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-2">
                Join the <span className="text-yellow-400">Winners Circle</span>
            </h1>
            <p className="text-slate-400 text-xs font-medium max-w-xs leading-relaxed">
                Stop guessing. Start winning with 98% accurate premium analysis and guaranteed tips.
            </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-8 relative z-10 space-y-6">
        
        {/* --- BENEFITS CARD --- */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">VIP Benefits</h3>
            <ul className="space-y-3.5">
                {["Daily 5-10 Odds (98% Win Rate)", "Weekend 50+ Odds Jackpot Ticket", "Qualify for ₦500,000 Monthly Prize", "Priority Customer Support (24/7)", "No Ads Experience"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-bold text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0 mt-0.5"><Check size={12} strokeWidth={4} /></div>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        {/* --- PAYMENT METHOD TOGGLE --- */}
        <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPaymentMethod('bank')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'bank' ? 'bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-[#111] border-white/10 text-slate-400 hover:bg-white/5'}`}>
                <CreditCard size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Bank Transfer</span>
            </button>
            <button onClick={() => setPaymentMethod('crypto')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition active:scale-95 ${paymentMethod === 'crypto' ? 'bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-[#111] border-white/10 text-slate-400 hover:bg-white/5'}`}>
                <Bitcoin size={24} /><span className="text-[10px] font-black uppercase tracking-wide">Crypto (USDT)</span>
            </button>
        </div>

        {/* --- PAYMENT DETAILS --- */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-yellow-500/30 rounded-2xl p-6 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
            <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Make Payment of</p>
            <h2 className="text-3xl font-black text-white mb-6 tracking-tight">
                {paymentMethod === 'bank' ? BANK_DETAILS.price : CRYPTO_DETAILS.price} <span className="text-sm font-normal text-slate-500">/ Month</span>
            </h2>

            {paymentMethod === 'bank' ? (
                <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10"><p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Bank Name</p><p className="font-bold text-sm text-slate-200">{BANK_DETAILS.bankName}</p></div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative group">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Account Number</p>
                        <p className="font-mono text-xl font-bold tracking-widest text-yellow-400 my-1">{BANK_DETAILS.accountNumber}</p>
                        <p className="text-[10px] text-slate-300 font-medium">{BANK_DETAILS.accountName}</p>
                        <button onClick={() => handleCopy(BANK_DETAILS.accountNumber, 'acc')} className="absolute right-3 top-1/2 -translate-y-1/2 bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400 transition active:scale-90 shadow-lg">{copied === 'acc' ? <Check size={16} /> : <Copy size={16} />}</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">USDT (TRC20) Address</p>
                    <p className="font-mono text-xs font-bold text-yellow-400 my-3 break-all px-2">{CRYPTO_DETAILS.address}</p>
                    <button onClick={() => handleCopy(CRYPTO_DETAILS.address, 'crypto')} className="flex items-center justify-center gap-2 w-full bg-yellow-500 hover:bg-yellow-400 text-black py-2.5 rounded-lg font-bold text-xs mt-2 transition active:scale-95 shadow-lg">{copied === 'crypto' ? <Check size={14} /> : <Copy size={14} />} Copy Address</button>
                </div>
            )}
        </div>

        {/* --- CONFIRMATION FORM --- */}
        <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18} /> Confirm Payment</h3>
            
            {/* ERROR MESSAGE DISPLAY */}
            {uploadError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg text-center break-words">
                    {uploadError}
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 pl-1">{paymentMethod === 'bank' ? 'Sender Name / Ref ID' : 'Transaction Hash'}</label>
                    <input type="text" placeholder={paymentMethod === 'bank' ? "e.g. John Doe" : "e.g. TxID12345..."} className="w-full bg-black border border-white/20 rounded-xl py-3.5 px-4 text-white text-sm focus:border-yellow-500 focus:outline-none placeholder:text-slate-600 transition-colors" value={ref} onChange={(e) => setRef(e.target.value)} />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 pl-1">Upload Screenshot (Optional)</label>
                    {!file ? (
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-yellow-500/50 hover:bg-white/5 transition group">
                            <UploadCloud className="text-slate-500 group-hover:text-yellow-500 transition-colors mb-2" size={28} />
                            <span className="text-[10px] font-bold text-slate-400">Tap to upload receipt</span>
                            <span className="text-[9px] text-slate-600 mt-1">Max 5MB (JPG/PNG)</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/20">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center shrink-0"><ImageIcon size={18} className="text-black" /></div>
                                <div className="min-w-0"><p className="text-xs font-bold text-slate-200 truncate">{file.name}</p><p className="text-[10px] text-slate-400">Ready to upload</p></div>
                            </div>
                            <button type="button" onClick={() => setFile(null)} className="p-2 text-slate-400 hover:text-red-500 transition"><X size={18} /></button>
                        </div>
                    )}
                </div>

                <button type="submit" disabled={loading || (!ref && !file)} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] transition active:scale-98 flex items-center justify-center gap-2 mt-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Submit Payment"}
                </button>
            </div>
        </form>

        <p className="text-center text-[10px] text-slate-500 pb-8">Having trouble? <a href="#" className="text-yellow-500 underline font-bold">Contact Support</a></p>
      </div>
    </div>
  );
}