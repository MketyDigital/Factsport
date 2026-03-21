'use client';

import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { verifyAdminPin } from './actions';
import { useRouter } from 'next/navigation';

export default function VaultLock() {
    const [pinInput, setPinInput] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const router = useRouter();

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUnlocking(true);
        setErrorMsg(null);

        // Send the PIN to the secure server action
        const result = await verifyAdminPin(pinInput);

        if (result.success) {
            // Refresh the page so the Layout sees the new cookie and lets us in!
            router.refresh();
        } else {
            setErrorMsg(result.error || 'Access Denied');
            setPinInput('');
            setIsUnlocking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md text-center relative overflow-hidden animate-in zoom-in-95">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-red-400"></div>
                
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-red-100 shadow-inner">
                    <Lock className="text-red-500" size={32} />
                </div>
                
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-2">Vault Locked</h2>
                <p className="text-sm text-slate-500 font-bold mb-8">Enter Master PIN to access Command Center.</p>
                
                <form onSubmit={handleUnlock} className="space-y-4">
                    <input 
                        type="password" 
                        value={pinInput}
                        onChange={(e) => {
                            setPinInput(e.target.value);
                            setErrorMsg(null);
                        }}
                        className={`w-full text-center text-3xl tracking-[0.5em] font-black border-2 rounded-xl bg-slate-50 py-4 focus:outline-none transition-colors ${errorMsg ? 'border-red-500 text-red-600' : 'border-slate-200 focus:border-red-500'}`}
                        placeholder="••••"
                        autoFocus
                        disabled={isUnlocking}
                    />
                    
                    {errorMsg && <span className="text-xs font-black text-red-500 uppercase tracking-widest block animate-pulse">{errorMsg}</span>}
                    
                    <button 
                        type="submit" 
                        disabled={isUnlocking || pinInput.length === 0}
                        className="w-full bg-[#0a1428] hover:bg-blue-900 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isUnlocking ? <Loader2 size={18} className="animate-spin" /> : null}
                        {isUnlocking ? 'Decrypting...' : 'Unlock Controls'}
                    </button>
                </form>
            </div>
            <div className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                FactSport Admin Systems <br/> Restricted Access Only
            </div>
        </div>
    );
}