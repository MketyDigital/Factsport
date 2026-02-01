'use client';

// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Loader2, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
// 🟢 NEW: Import Turnstile
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  // ✅ TRACK FAILED ATTEMPTS
  const [attempts, setAttempts] = useState(0);

  // ✅ VERIFICATION STATE
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // 🟢 NEW: CAPTCHA STATE
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // 1. SAFE SESSION CHECK
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard'); 
      } else {
        setCheckingSession(false);
      }
    };
    checkUser();
  }, [router, supabase]);

  // 2. GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  // 3. EMAIL LOGIN (With Captcha & Smart Error Handling)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🟢 SECURITY CHECK
    if (!captchaToken) {
        setError("Please complete the security check.");
        return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password,
        options: {
            captchaToken: captchaToken, // 🚀 Required by Supabase
        }
    });

    if (error) {
      // ⚠️ CATCH "UNCONFIRMED" ERROR
      if (error.message.includes("Email not confirmed")) {
        setNeedsVerification(true); 
      } else {
        setError(error.message); 
        setAttempts((prev) => prev + 1);
      }
      
      // 🟢 RESET CAPTCHA ON ERROR
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setLoading(false);
    } else {
      router.refresh();
      router.replace('/dashboard');
    }
  };

  // 4. RESEND LINK LOGIC
  const handleResendLink = async () => {
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      // Note: Resend might also require captcha depending on strictness settings, 
      // but usually standard login protection covers the session entry.
    });
    setResendLoading(false);
    
    if (error) alert(error.message);
    else alert(`Link resent to ${email}! Check your Inbox (and Spam).`);
  };

  // ✅ LOADING STATE
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a1428] flex items-center justify-center">
        <Loader2 className="text-white animate-spin" size={32} />
      </div>
    );
  }

  // ✅ "NEEDS VERIFICATION" SCREEN
  if (needsVerification) {
    return (
      <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center relative z-10">
          
          <div className="w-16 h-16 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          
          <h2 className="text-2xl font-black text-white mb-2">Check your Email!</h2>
          <p className="text-slate-400 text-sm mb-6">
            You need to verify your account before logging in.
            <br />
            <span className="text-xs italic opacity-70">(We sent a link to {email})</span>
          </p>

          {/* Solution A: Switch to Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mb-4"
          >
            {googleLoading ? <Loader2 className="animate-spin" /> : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                   <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.16-7.27c1.61 0 3.08.59 4.23 1.57l2.14-2.05C16.66 2.5 14.4 2 12.16 2C6.65 2 2 6.5 2 12s4.65 10 10.16 10c7.15 0 10.86-5.52 9.19-10.9z"/>
                </svg>
                Sign in with Google (Instant)
              </>
            )}
          </button>

          {/* Solution B: Resend Link */}
          <button 
            onClick={handleResendLink}
            disabled={resendLoading}
            className="text-sm text-slate-400 hover:text-white underline flex items-center justify-center gap-2 mx-auto mb-6"
          >
            {resendLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Resend Verification Link
          </button>

          <button 
            onClick={() => setNeedsVerification(false)}
            className="text-xs text-slate-500 hover:text-slate-400"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ✅ STANDARD LOGIN SCREEN
  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-10"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-[#0a1428] shadow-lg border border-white/10 mb-4">
            <span className="text-2xl font-black text-white italic">FS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Welcome Back</h1>
        </div>

        {/* GOOGLE BUTTON (Primary) */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full bg-white text-black font-bold py-3.5 rounded-xl shadow-lg hover:bg-gray-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mb-6"
        >
          {googleLoading ? <Loader2 size={20} className="animate-spin" /> : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.16-7.27c1.61 0 3.08.59 4.23 1.57l2.14-2.05C16.66 2.5 14.4 2 12.16 2C6.65 2 2 6.5 2 12s4.65 10 10.16 10c7.15 0 10.86-5.52 9.19-10.9z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-x-0 h-px bg-white/10"></div>
          <span className="relative bg-[#0a1428] px-2 text-xs text-slate-500 font-bold uppercase">Or login with email</span>
        </div>

        {/* Email Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* 🔴 SMART TROUBLE ALERT (Shows after 3 fails) */}
          {attempts >= 3 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs text-center animate-in fade-in slide-in-from-top-2">
                <p className="font-bold mb-2">Trouble logging in?</p>
                <div className="flex justify-center gap-3">
                    <Link href="/forgot-password" className="underline hover:text-white">Reset Password</Link>
                    <button type="button" onClick={handleGoogleLogin} className="underline hover:text-white">Use Google</button>
                </div>
            </div>
          )}

          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input type="email" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-600" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
                 <label className="text-xs font-bold text-slate-300 uppercase">Password</label>
                 <Link href="/forgot-password" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                   Forgot?
                 </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input type="password" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-600" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

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
          
          <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Sign In <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">Don't have an account? <Link href="/register" className="text-white font-bold hover:text-red-500 transition-colors">Register Now</Link></p>
        </div>
      </div>
    </div>
  );
}