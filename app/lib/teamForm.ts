import { createClient } from '@supabase/supabase-js'; // 🟢 Uses Anon Client to protect your page caching!
import { getTeamQueryFilter, getCoreTeamName } from '@/app/lib/teamAliases';

export async function getTeamForm(teamName: string) {
    if (!teamName) return [];
    
    // 🟢 Guaranteed to prevent Next.js from checking cookies
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    const queryFilter = getTeamQueryFilter(teamName);
    const coreName = getCoreTeamName(teamName).toLowerCase();
    const originalTarget = teamName.toLowerCase().replace(/['"]/g, '');

    try {
        const { data } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score')
            .in('status', ['FT', 'FINISHED', 'AET', 'PEN', 'AWARDED', 'ABD'])
            .or(queryFilter)
            .lt('match_date', new Date().toISOString())
            .order('match_date', { ascending: false })
            .limit(5);

        if (!data || data.length === 0) return [];

        const form = data.map(m => {
            const homeName = (m.home_team || '').toLowerCase();
            const awayName = (m.away_team || '').toLowerCase();
            
            // 🧠 THE DERBY CHECKER
            // Scores both teams to figure out who is ACTUALLY the team we are looking for.
            let homeMatchScore = homeName.includes(coreName) ? 1 : 0;
            if (homeName.includes(originalTarget)) homeMatchScore++;

            let awayMatchScore = awayName.includes(coreName) ? 1 : 0;
            if (awayName.includes(originalTarget)) awayMatchScore++;

            const isHome = homeMatchScore >= awayMatchScore;
            
            const hScore = m.home_score;
            const aScore = m.away_score;
            
            if (hScore === null || aScore === null) return '-';
            if (hScore === aScore) return 'D';
            
            if (isHome) {
                return hScore > aScore ? 'W' : 'L';
            } else {
                return aScore > hScore ? 'W' : 'L';
            }
        });

        return form.reverse(); 
    } catch (e) {
        return [];
    }
}