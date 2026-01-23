'use client';

export const runtime = 'edge';

import { useState } from 'react';
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
  // -------------

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const selected = e.target.files[0];
        if (selected.size > 5 * 1024 * 1024) { // 5MB limit
            setUploadError("File too large (Max 5MB)");
            return;
        }
        setFile(selected);
        setUploadError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !ref) {
        setUploadError("Please provide proof (Screenshot OR Ref ID)");
        return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        router.push('/login');
        return;
    }

    let proofUrl = null;

    // 1. Upload Image if exists
    if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
            .from('payment_proofs')
            .upload(fileName, file);

        if (uploadErr) {
            setUploadError("Image upload failed. Try again.");
            setLoading(false);
            return;
        }
        
        // Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from('payment_proofs')
            .getPublicUrl(fileName);
            
        proofUrl = publicUrlData.publicUrl;
    }

    // 2. Insert Request
    const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'monthly',
        amount: paymentMethod === 'bank' ? 5000 : 5,
        payment_method: paymentMethod,
        transaction_ref: ref || 'Screenshot Uploaded',
        proof_url: proofUrl
    });

    if (!error) {
        setSuccess(true);
    } else {
        setUploadError("Submission failed. Contact support.");
    }
    setLoading(false);
  };

  if (success) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-yellow-500/30 p-8 rounded-2xl text-center max-w-md w-full">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black">
                    <Check size={32} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Proof Received!</h2>
                <p className="text-slate-400 text-sm mb-6">
                    Our team will verify your transaction shortly. Your account will be upgraded within 30 minutes.
                </p>
                <button onClick={() => router.push('/dashboard')} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1428] pb-20 font-sans text-white">
      
      {/* Header */}
      <div className="relative overflow-hidden bg-black pb-10 pt-8 px-6 rounded-b-[3rem] shadow-2xl border-b border-yellow-900/30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-600 rounded-full blur-[120px] opacity-20"></div>
        <div className="flex flex-col items-center text-center relative z-10">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.4)] mb-4">
                <Trophy className="text-black fill-black" size={28} />
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">
                Join the <span className="text-yellow-400">Winners Circle</span>
            </h1>
            <p className="text-slate-400 text-xs mt-2 max-w-xs">
                Stop guessing. Start winning with premium analysis and guaranteed tips.
            </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-10 space-y-6">
        
        {/* Payment Selector */}
        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={() => setPaymentMethod('bank')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'bank' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}
            >
                <CreditCard size={24} />
                <span className="text-xs font-black uppercase">Bank Transfer</span>
            </button>
            <button 
                onClick={() => setPaymentMethod('crypto')}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${paymentMethod === 'crypto' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-[#111] border-white/10 text-slate-400'}`}
            >
                <Bitcoin size={24} />
                <span className="text-xs font-black uppercase">Crypto (USDT)</span>
            </button>
        </div>

        {/* Payment Details */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-yellow-500/30 rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
            
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Make Payment of</p>
            <h2 className="text-3xl font-black text-white mb-6">
                {paymentMethod === 'bank' ? BANK_DETAILS.price : CRYPTO_DETAILS.price} <span className="text-sm font-normal text-slate-500">/ Month</span>
            </h2>

            {paymentMethod === 'bank' ? (
                <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <p className="text-[10px] text-slate-400 uppercase">Bank Name</p>
                        <p className="font-bold">{BANK_DETAILS.bankName}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative">
                        <p className="text-[10px] text-slate-400 uppercase">Account Number</p>
                        <p className="font-mono text-xl font-bold tracking-widest text-yellow-400 my-1">{BANK_DETAILS.accountNumber}</p>
                        <p className="text-[10px] text-slate-300">{BANK_DETAILS.accountName}</p>
                        <button 
                            onClick={() => handleCopy(BANK_DETAILS.accountNumber, 'acc')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400"
                        >
                            {copied === 'acc' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 rounded-xl p-3 border border-white/10 relative">
                    <p className="text-[10px] text-slate-400 uppercase">USDT (TRC20) Address</p>
                    <p className="font-mono text-xs font-bold text-yellow-400 my-2 break-all">{CRYPTO_DETAILS.address}</p>
                    <button 
                        onClick={() => handleCopy(CRYPTO_DETAILS.address, 'crypto')}
                        className="flex items-center justify-center gap-2 w-full bg-yellow-500 text-black py-2 rounded-lg font-bold text-xs mt-2"
                    >
                        {copied === 'crypto' ? <Check size={14} /> : <Copy size={14} />} Copy Address
                    </button>
                </div>
            )}
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="text-green-500" size={16} /> Submit Proof
            </h3>
            
            {uploadError && <div className="mb-4 p-3 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg">{uploadError}</div>}

            <div className="space-y-4">
                {/* 1. Transaction Ref Input */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">
                        {paymentMethod === 'bank' ? 'Sender Name / Ref ID' : 'Transaction Hash'}
                    </label>
                    <input 
                        type="text" 
                        placeholder={paymentMethod === 'bank' ? "e.g. John Doe" : "e.g. TxID12345..."}
                        className="w-full bg-black border border-white/20 rounded-xl py-3 px-4 text-white text-sm focus:border-yellow-500 focus:outline-none placeholder:text-slate-600"
                        value={ref}
                        onChange={(e) => setRef(e.target.value)}
                    />
                </div>

                {/* 2. File Upload Area */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">
                        Upload Screenshot (Optional)
                    </label>
                    
                    {!file ? (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-yellow-500/50 hover:bg-white/5 transition">
                            <UploadCloud className="text-slate-500 mb-1" size={24} />
                            <span className="text-[10px] text-slate-400">Tap to upload receipt</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    ) : (
                        <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/20">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center shrink-0">
                                    <ImageIcon size={16} className="text-black" />
                                </div>
                                <span className="text-xs truncate text-slate-200">{file.name}</span>
                            </div>
                            <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={loading || (!ref && !file)}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Submit Payment"}
                </button>
            </div>
        </form>

        <p className="text-center text-[10px] text-slate-500 pb-8">
            Need help? <a href="#" className="text-yellow-500 underline">Contact Support</a>
        </p>

      </div>
    </div>
  );
}