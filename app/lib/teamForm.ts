import { createClient } from '@supabase/supabase-js'; 
import { getCoreTeamName } from '@/app/lib/teamAliases';

export async function getTeamForm(teamName: string) {
    if (!teamName) return [];
    
    // 🟢 Guaranteed to prevent Next.js from checking cookies
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // 1. Get the smart core name from your aliases file (e.g., "Manchester United")
    const coreName = getCoreTeamName(teamName).toLowerCase();
    const originalTarget = teamName.toLowerCase().replace(/['"]/g, '');

    // 2. Extract the absolute base word for a broad database search (e.g., "Manchester")
    const baseSearchWord = coreName.split(' ')[0];

    try {
        // 3. OVER-FETCH: Ask DB for 20 matches using the broad base word. 
        // This guarantees we capture all variations like "Man Utd", "Manchester Utd", etc.
        const { data } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score')
            .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'])
            .or(`home_team.ilike.%${baseSearchWord}%,away_team.ilike.%${baseSearchWord}%`)
            .lt('match_date', new Date().toISOString())
            .order('match_date', { ascending: false })
            .limit(20); 

        if (!data || data.length === 0) return [];

        const form = [];

        for (const m of data) {
            const homeName = (m.home_team || '').toLowerCase();
            const awayName = (m.away_team || '').toLowerCase();
            
            // 4. THE JAVASCRIPT FILTER (The Derby Checker)
            // It ignores "Man City" matches, and strictly accepts "Man Utd" or "Manchester United"
            const isHomeMatch = homeName.includes(coreName) || homeName.includes(originalTarget) || coreName.includes(homeName);
            const isAwayMatch = awayName.includes(coreName) || awayName.includes(originalTarget) || coreName.includes(awayName);
            
            // Skip false positives from the broad database query!
            if (!isHomeMatch && !isAwayMatch) continue; 

            const isHome = isHomeMatch;
            const hScore = m.home_score;
            const aScore = m.away_score;
            
            if (hScore === null || aScore === null) continue;
            
            let result = 'D';
            if (hScore !== aScore) {
                if (isHome) result = hScore > aScore ? 'W' : 'L';
                else result = aScore > hScore ? 'W' : 'L';
            }
            
            form.push(result);
            
            // 🟢 Stop exactly when we hit 5 valid matches!
            if (form.length === 5) break; 
        }

        // Return them in chronological order (Oldest -> Newest left to right)
        return form.reverse(); 
    } catch (e) {
        return [];
    }
}