'use client';

// ✅ RUNS ON EDGE (Must come AFTER 'use client')
export const runtime = 'edge';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Phone, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Supabase Login
    const { error } = await supabase.auth.signInWithPassword({
      email: `${phone}@factsport.com`, // We map phone to email internally
      password,
    });

    if (error) {
      setError(error.message === 'Invalid login credentials' 
        ? 'Incorrect Phone or Password' 
        : error.message);
      setLoading(false);
    } else {
      router.refresh();
      router.push('/'); // Redirect to Home
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full blur-[120px] opacity-20"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-red-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-[#0a1428] shadow-lg border border-white/10 mb-4">
            <span className="text-2xl font-black text-white italic">FS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Welcome Back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to access your VIP Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input 
                type="tel" 
                required
                className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-600 transition-colors"
                placeholder="080 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input 
                type="password" 
                required
                className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-600 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Sign In <ArrowRight size={18} /></>}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">
            Don't have an account?{' '}
            <Link href="/register" className="text-white font-bold hover:text-red-500 transition-colors">
              Register Now
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}