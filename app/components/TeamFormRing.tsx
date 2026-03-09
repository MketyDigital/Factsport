'use client';

export default function TeamFormRing({ teamId, teamName, matches }: { teamId?: number, teamName: string, matches: any[] }) {
    if (!matches || matches.length === 0) return null;

    // Filter to only finished matches and sort by most recent
    const validMatches = matches
        .filter(m => m.status === 'FINISHED' || m.status === 'AWARDED')
        .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
        .slice(0, 5); // Get last 5 matches

    if (validMatches.length === 0) return null;

    // Calculate form (W, D, L)
    const form = validMatches.map(m => {
        let hScore = m.score?.fullTime?.home ?? m.score?.regularTime?.home;
        let aScore = m.score?.fullTime?.away ?? m.score?.regularTime?.away;
        
        if (typeof hScore !== 'number' || typeof aScore !== 'number') return null;

        let isHome = false;
        if (teamId && m.homeTeam?.id) {
            isHome = (m.homeTeam.id === teamId);
        } else {
            const matchHomeName = (m.homeTeam?.shortName || m.homeTeam?.name || '').toLowerCase();
            isHome = matchHomeName.includes(teamName.toLowerCase()) || teamName.toLowerCase().includes(matchHomeName);
        }

        if (hScore === aScore) return 'D';
        if (hScore > aScore) return isHome ? 'W' : 'L';
        return isHome ? 'L' : 'W';
    }).filter(Boolean).reverse(); // Reverse so oldest is left, newest is right

    return (
        <div className="flex items-center gap-1 mt-2">
            {form.map((result, i) => (
                <div 
                    key={i} 
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white shadow-sm border border-black/10
                        ${result === 'W' ? 'bg-emerald-500' : result === 'L' ? 'bg-red-500' : 'bg-slate-400'}
                    `}
                >
                    {result}
                </div>
            ))}
        </div>
    );
}