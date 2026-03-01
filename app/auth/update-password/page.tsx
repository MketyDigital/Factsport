'use client';

// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 🟢 NEW: Toggle states for viewing passwords
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🟢 NEW: Check if passwords match before sending to Supabase
    if (password !== confirmPassword) {
        setError("Passwords do not match. Please try again.");
        return;
    }

    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    setLoading(true);
    setError(null);
    
    // Updates the password for the currently logged-in user
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/dashboard'); // Redirect to dashboard on success
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-10"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <h1 className="text-2xl font-black text-white italic uppercase mb-2">New Password</h1>
        <p className="text-sm text-slate-400 mb-6">Create a new secure password for your account.</p>

        <form onSubmit={handleUpdate} className="space-y-4">
            
            {/* NEW PASSWORD FIELD */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase ml-1">New Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-red-600 transition"
                        placeholder="••••••••"
                        minLength={6}
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            {/* CONFIRM PASSWORD FIELD */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase ml-1">Confirm Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
                    <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-red-600 transition"
                        placeholder="••••••••"
                        minLength={6}
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors"
                    >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <button 
                disabled={loading}
                className="w-full bg-red-600 text-white font-black uppercase italic tracking-wider py-3.5 rounded-xl mt-2 hover:bg-red-500 transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <>Update Password <ArrowRight size={18}/></>}
            </button>
        </form>
      </div>
    </div>
  );
}