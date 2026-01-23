'use client';

import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  return (
    <button 
      onClick={handleSignOut}
      className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-white"
      title="Sign Out"
    >
      <LogOut size={18} />
    </button>
  );
}