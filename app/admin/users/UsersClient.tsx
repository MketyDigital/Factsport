'use client';

import { useState } from 'react';
import { Search, Crown, Shield, User, Loader2, CheckCircle, Lock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function UsersClient({ initialUsers }: { initialUsers: any[] }) {
    const [users, setUsers] = useState(initialUsers);
    const [search, setSearch] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    
    // 🔒 Lock Screen State
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pinInput, setPinInput] = useState('');

    // 📄 Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 12;

    // 1. Filter the users based on the search bar
    const filteredUsers = users.filter(u => 
        (u.email || '').toLowerCase().includes(search.toLowerCase()) || 
        (u.full_name || '').toLowerCase().includes(search.toLowerCase())
    );

    // 2. Slice the filtered users for the current page
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

    // 3. Handle Search (Reset to page 1 when typing)
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setCurrentPage(1); 
    };

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pinInput.length > 0) setIsUnlocked(true);
    };

    const toggleVip = async (userId: string, currentStatus: boolean) => {
        setLoadingId(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: userId, 
                    isVip: !currentStatus, 
                    action: 'toggle_vip',
                    pin: pinInput 
                })
            });

            if (res.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, is_vip: !currentStatus } : u));
            } else {
                const data = await res.json();
                alert(`Error: ${data.error}`);
                if (res.status === 401) setIsUnlocked(false); 
            }
        } catch (error) {
            alert("Failed to connect to server.");
        }
        setLoadingId(null);
    };

    // 🔒 RENDER THE LOCK SCREEN IF NOT UNLOCKED
    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50">
                        <Lock className="text-red-500" size={24} />
                    </div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-1">Vault Locked</h2>
                    <p className="text-xs text-slate-500 font-bold mb-6">Enter Master PIN to access users.</p>
                    
                    <form onSubmit={handleUnlock} className="space-y-3">
                        <input 
                            type="password" 
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            className="w-full text-center text-2xl tracking-[0.5em] font-black border-2 border-slate-200 rounded-xl bg-slate-50 py-3 focus:outline-none focus:border-red-500 transition-colors"
                            placeholder="••••"
                            autoFocus
                        />
                        <button type="submit" className="w-full bg-[#0a1428] text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md active:scale-95 transition-all text-sm">
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 🔓 RENDER THE PAGINATED USER LIST ONCE UNLOCKED
    return (
        <div className="space-y-4">
            
            {/* SEARCH BAR */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 sticky top-[60px] z-10">
                <Search className="text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by email or name..." 
                    value={search}
                    onChange={handleSearch}
                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400"
                />
            </div>

            {/* STATS */}
            <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    {filteredUsers.length} Users
                </span>
                <span className="text-[10px] font-black uppercase text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full tracking-widest">
                    {users.filter(u => u.is_vip).length} VIPs
                </span>
            </div>

            {/* USERS GRID (Only shows current page!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentUsers.map((user) => (
                    <div key={user.id} className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${user.is_vip ? 'border-yellow-300 bg-gradient-to-br from-white to-yellow-50/30' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner border ${user.is_vip ? 'bg-yellow-100 border-yellow-200' : 'bg-slate-100 border-slate-200'}`}>
                                    {user.is_vip ? <Crown size={18} className="text-yellow-600" /> : <User size={18} className="text-slate-400" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xs font-black text-slate-800 truncate">{user.full_name || 'No Name Provided'}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 truncate">{user.email || 'No Email'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => toggleVip(user.id, user.is_vip)}
                                disabled={loadingId === user.id}
                                className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg shadow-sm border transition-all active:scale-95 ${
                                    user.is_vip 
                                        ? 'bg-yellow-500 border-yellow-600 text-black hover:bg-yellow-400' 
                                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                }`}
                            >
                                {loadingId === user.id ? <Loader2 size={14} className="animate-spin" /> : user.is_vip ? <CheckCircle size={14} /> : <Shield size={14} />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* PAGINATION CONTROLS */}
            {filteredUsers.length > 0 && (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-200 mt-4">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:active:scale-100 active:scale-95 transition"
                    >
                        <ChevronLeft size={14} /> Prev
                    </button>
                    
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:active:scale-100 active:scale-95 transition"
                    >
                        Next <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* EMPTY STATE */}
            {filteredUsers.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <User size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-500">No users found.</p>
                </div>
            )}
        </div>
    );
}