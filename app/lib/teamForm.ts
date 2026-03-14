import { createClient } from '@/app/lib/supabase/server';
import { getTeamQueryFilter } from '@/app/lib/teamAliases';

export async function getTeamForm(teamName: string) {
    if (!teamName) return [];
    const supabase = createClient();
    
    const queryFilter = getTeamQueryFilter(teamName);

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
            const filterString = queryFilter.toLowerCase();
            const homeName = (m.home_team || '').toLowerCase();
            const isHome = filterString.includes(`"${homeName}"`);
            
            const hScore = m.home_score;
            const aScore = m.away_score;
            
            if (hScore === null || aScore === null) return '-';
            if (hScore === aScore) return 'D';
            if (isHome) return hScore > aScore ? 'W' : 'L';
            return aScore > hScore ? 'W' : 'L';
        });

        return form.reverse(); 
    } catch (e) {
        return [];
    }
}