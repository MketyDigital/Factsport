import { createClient } from '@supabase/supabase-js'; 
import { getTeamQueryFilter, getTeamSearchVariations } from '@/app/lib/teamAliases';

export async function getTeamForm(teamName: string) {
    if (!teamName) return [];
    
    // 🟢 Guaranteed to prevent Next.js from checking cookies
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // 1. Get the massive multi-variation query string
    const exactQueryFilter = getTeamQueryFilter(teamName);
    
    // Get the array of words to validate against later
    const variations = getTeamSearchVariations(teamName).map(v => v.toLowerCase());

    try {
        // 2. Fetch safely! We grab 30 matches because multi-competition teams play a lot.
        const { data } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score')
            .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'])
            .or(exactQueryFilter)
            .lt('match_date', new Date().toISOString())
            .order('match_date', { ascending: false })
            .limit(30); 

        if (!data || data.length === 0) return [];

        const form = [];

        for (const m of data) {
            const homeName = (m.home_team || '').toLowerCase();
            const awayName = (m.away_team || '').toLowerCase();
            
            // 3. Robust JS Validation: Check if ANY variation is inside the DB name.
            // Solves the issue: ESPN sends "man city", Variations array has "man city". -> MATCH!
            const isHomeMatch = variations.some(v => homeName.includes(v) || v.includes(homeName));
            const isAwayMatch = variations.some(v => awayName.includes(v) || v.includes(awayName));
            
            // If it's a false positive (like Leeds United sneaking into a USA search), skip it!
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
            
            // 🟢 Stop exactly when we hit 5 valid, confirmed matches!
            if (form.length === 5) break; 
        }

        // Return them in chronological order (Oldest -> Newest left to right)
        return form.reverse(); 
    } catch (e) {
        return [];
    }
}