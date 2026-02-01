'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, Save, User, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (data) setName(data.full_name || '');
    };
    fetchProfile();
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
        if (error) setMsg('Error updating profile.');
        else {
            setMsg('Profile updated successfully!');
            router.refresh(); // Refresh server components to show new name
        }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-900 p-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex items-center gap-3">
            <Link href="/dashboard" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><ChevronLeft size={18} /></Link>
            <h1 className="font-bold">Profile Settings</h1>
        </div>

        <div className="p-6 space-y-6">
            <div className="flex justify-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                    <User size={32} className="text-slate-400" />
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Display Name</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-blue-500 transition"
                    placeholder="e.g. PredictionKing"
                />
            </div>

            {msg && <div className={`text-xs font-bold text-center ${msg.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{msg}</div>}

            <button 
                onClick={handleUpdate} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
            </button>
        </div>

      </div>
    </div>
  );
}