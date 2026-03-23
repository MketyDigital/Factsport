'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

const AuthContext = createContext<any>(null);

const ADMIN_EMAILS = [
    'mkposcosunday@gmail.com', 
    'factsportlive@gmail.com', 
    'fact@factsport.com'
];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const fetchUserAndRoles = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
          const currentUser = session.user;
          
          // 🟢 SPEED FIX: Unlock the UI instantly so the Header stops loading!
          if (isMounted) {
              setUser(currentUser);
              setLoading(false);
          }

          // 🟢 BACKGROUND TASK: Fetch the heavy VIP/Admin status silently
          const userEmail = currentUser.email?.toLowerCase() || '';
          const { data: profile } = await supabase
              .from('profiles')
              .select('role, is_vip, username, avatar_url')
              .eq('id', currentUser.id)
              .single();

          const adminStatus = ADMIN_EMAILS.includes(userEmail) || profile?.role === 'admin' || currentUser.user_metadata?.is_admin === true;
          const vipStatus = adminStatus || profile?.is_vip === true || currentUser.user_metadata?.is_vip === true;

          if (isMounted) {
              setUser({ ...currentUser, profileData: profile });
              setIsAdmin(adminStatus);
              setIsVip(vipStatus);
          }
      } else {
          if (isMounted) {
              setUser(null);
              setIsAdmin(false);
              setIsVip(false);
              setLoading(false);
          }
      }
    };

    fetchUserAndRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
          if (isMounted) {
              setUser(null);
              setIsAdmin(false);
              setIsVip(false);
              router.refresh(); 
          }
      } else if (event === 'SIGNED_IN') {
          fetchUserAndRoles(); 
      }
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isVip, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);