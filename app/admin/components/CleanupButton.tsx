'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { Trash2, Loader2, Database } from 'lucide-react';

export default function CleanupButton() {
  const [cleaning, setCleaning] = useState(false);
  const supabase = createClient();

  const handleCleanup = async () => {
    const isConfirmed = confirm(
        "⚠️ DANGER ZONE: \n\n" +
        "This will PERMANENTLY DELETE all matches older than 1 YEAR (12 Months).\n" +
        "All associated history and predictions for those matches will be gone forever.\n\n" +
        "Are you sure?"
    );

    if (!isConfirmed) return;

    setCleaning(true);
    
    // Call the SQL function we created
    const { error } = await supabase.rpc('delete_old_matches', { months_to_keep: 12 });

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("✅ System Cleaned! Matches older than 1 year removed.");
    }
    
    setCleaning(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between items-start gap-4">
        <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Database size={18} className="text-slate-400" /> Database Hygiene
            </h3>
            <p className="text-xs text-slate-500 mt-1">
                Remove matches older than 12 months to keep the app fast.
            </p>
        </div>
        <button 
            onClick={handleCleanup} 
            disabled={cleaning}
            className="w-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 py-3 rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2"
        >
            {cleaning ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            {cleaning ? 'Cleaning...' : 'Delete Old Data (>12m)'}
        </button>
    </div>
  );
}