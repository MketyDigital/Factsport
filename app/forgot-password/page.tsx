'use client';

// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { useState, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
// 🟢 NEW: Import Turnstile
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🟢 NEW: Captcha State
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🟢 SECURITY CHECK
    if (!captchaToken) {
        setError("Please complete the security check.");
        return;
    }

    setLoading(true);
    setError(null);

    // ✅ IMPORTANT: Points to the callback route first to handle the session exchange
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/auth/update-password`,
      // 🟢 PASS TOKEN TO SUPABASE
      captchaToken: captchaToken, 
    });

    if (error) {
      setError(error.message);
      // 🟢 RESET WIDGET ON ERROR
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-10"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        
        {/* Back Link */}
        <Link href="/login" className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Login
        </Link>

        <h1 className="text-2xl font-black text-white italic uppercase mb-2">Reset Password</h1>
        <p className="text-sm text-slate-400 mb-6">Enter your email and we'll send you a secure link to reset your password.</p>

        {success ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center animate-in fade-in zoom-in">
                <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={24} />
                </div>
                <h3 className="text-sm font-black text-white mb-1 uppercase">Check your inbox</h3>
                <p className="text-xs text-slate-300">We've sent a password reset link to <br/><span className="font-bold text-white">{email}</span>.</p>
            </div>
        ) : (
            <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase ml-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={18} />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                            placeholder="name@example.com"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center flex items-center justify-center gap-2">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                {/* 🛡️ CLOUDFLARE TURNSTILE WIDGET */}
                <div className="flex justify-center my-2 min-h-[65px]">
                    <Turnstile
                        ref={turnstileRef}
                        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                        onSuccess={(token) => setCaptchaToken(token)}
                        onError={() => setCaptchaToken(null)}
                        onExpire={() => setCaptchaToken(null)}
                        options={{
                            theme: 'dark', // Matches your dark UI
                            size: 'flexible'
                        }}
                    />
                </div>

                <button 
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-black uppercase italic tracking-wider py-3.5 rounded-xl hover:bg-blue-500 transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
                </button>
            </form>
        )}
      </div>
    </div>
  );
}