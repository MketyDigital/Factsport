'use client';

// ✅ RUNS ON EDGE (Must come AFTER 'use client')
export const runtime = 'edge';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Phone, Lock, Loader2, Trophy } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ fullName: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Sign Up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `${formData.phone}@factsport.com`,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // 2. Create Profile (API Call for consistency)
    const res = await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify({ 
            id: authData.user?.id,
            email: `${formData.phone}@factsport.com`,
            ...formData 
        })
    });

    if (res.ok) {
        router.push('/');
    } else {
        setError("Account created but profile setup failed. Contact Admin.");
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1428] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">Join the War Machine</h1>
          <p className="text-slate-400 text-sm mt-1">Create an account to start winning</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">{error}</div>}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input type="text" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none" placeholder="John Doe"
                value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input type="tel" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none" placeholder="080..."
                value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input type="password" required className="w-full bg-[#050b16] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:border-red-600 focus:outline-none" placeholder="••••••••"
                value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading ? <Loader2 size={20} className="animate-spin" /> : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition">Already have an account? Login</Link>
        </div>
      </div>
    </div>
  );
}