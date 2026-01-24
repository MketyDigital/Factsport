'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

export default function ResetMonthButton() {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    // 🔒 SAFETY CHECK 1
    if (!confirm("⚠️ ARE YOU SURE?\n\nThis will reset ALL monthly points to 0 for every user.\n\nThis cannot be undone.")) {
      return;
    }

    // 🔒 SAFETY CHECK 2 (Type to confirm)
    const verification = prompt("Type 'RESET' to confirm you want to start a new month:");
    if (verification !== 'RESET') {
      alert("Cancelled. Spelling must be exact.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const res = await fetch('/api/admin/reset-monthly', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      alert("✅ SUCCESS!\n\nNew Month Started. All monthly scores are now 0.");
      window.location.reload();

    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 p-6 rounded-2xl mb-8">
      <div className="flex items-start gap-4">
        <div className="bg-red-100 p-3 rounded-full text-red-600">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-red-900">Monthly Reset Zone</h3>
          <p className="text-sm text-red-700 mb-4 max-w-md">
            Click this button only on the <b>1st of the month</b>. It will wipe the Leaderboard "Monthly Points" to zero so a new race can begin.
          </p>
          
          <button 
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <RotateCcw size={18} />}
            {loading ? "Resetting Database..." : "START NEW MONTH"}
          </button>
        </div>
      </div>
    </div>
  );
}