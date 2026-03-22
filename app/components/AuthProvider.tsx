'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

const AuthContext = createContext<any>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    // 1. Check active session on load
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
          setUser(session?.user || null);
          setLoading(false);
      }
    };
    checkUser();

    // 2. Listen for changes (Login, Logout, Auto-refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isMounted) {
          setUser(session?.user || null);
          if (event === 'SIGNED_OUT') {
            router.refresh(); // Clear cache on logout
          }
      }
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, [router]); // 🟢 FIXED: Removed 'supabase' from the array!

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);