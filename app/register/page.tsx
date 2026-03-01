'use client';

// ✅ RUNS ON EDGE
export const runtime = 'edge';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Phone, Lock, Loader2, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false); // 🟢 NEW: Password Toggle
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/dashboard');
      else setCheckingSession(false);
    };
    checkSession();
  }, [router, supabase]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
        setError("Please complete the security check.");
        return;
    }
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        captchaToken: captchaToken,
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    setSignupSuccess(true);
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a1428] flex items-center justify-center">
        <Loader2 className="text-white animate-spin" size={32} />
      </div>
    );
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
          <h2 className="text-2xl font-black text-white mb-2">Check your Inbox!</h2>
          <p className="text-slate-400 text-sm mb-6">We sent a verification link to <span className="text-white font-bold">{formData.email}</span>.<br />You need to click it before you can log in.</p>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold mb-6">Tip: Check your Spam folder if you don't see it.</div>
          <Link href="/login" className="block w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4 font-sans">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px] opacity-20"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-[#0a1428] shadow-lg border border-white/10 mb-4">
             <span className="text-xl font-black text-white italic">FS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Join FactSport</h1>
        </div>

        <button onClick={handleGoogleLogin} disabled={googleLoading || loading} className="w-full bg-white text-black font-bold py-3.5 rounded-xl shadow-lg hover:bg-gray-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mb-6">
          {googleLoading ? <Loader2 size={20} className="animate-spin" /> : <>Sign up with Google</>}
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-x-0 h-px bg-white/10"></div>
          <span className="relative bg-[#0a1428] px-2 text-xs text-slate-500 font-bold uppercase">Or continue with email</span>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-pulse">{error}</div>}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Full Name</label>
            <div className="relative group">
              <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-white transition-colors" size={18} />
              <input type="text" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none transition-all text-sm font-medium" placeholder="John Doe" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-white transition-colors" size={18} />
              <input type="email" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none transition-all text-sm font-medium" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Phone Number</label>
            <div className="relative group">
              <Phone className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-white transition-colors" size={18} />
              <input type="tel" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none transition-all text-sm font-medium" placeholder="080..." value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 tracking-wider">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-white transition-colors" size={18} />
              {/* 🟢 UPDATED: Toggleable Password Field */}
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none transition-all text-sm font-medium" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
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

          <div className="flex justify-center my-2 min-h-[65px]">
             <Turnstile ref={turnstileRef} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={(token) => setCaptchaToken(token)} onError={() => setCaptchaToken(null)} onExpire={() => setCaptchaToken(null)} options={{ theme: 'dark', size: 'flexible' }} />
          </div>

          <button type="submit" disabled={loading || googleLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-slate-400 text-xs">Already have an account? <Link href="/login" className="text-white font-bold hover:text-blue-400 transition-colors">Login Here</Link></p>
        </div>
      </div>
    </div>
  );
}